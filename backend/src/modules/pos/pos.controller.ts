import { Router, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { authMiddleware, requireRole, type AuthRequest } from '../../middleware/auth.js';
import { z } from 'zod';

export const posRouter = Router();
posRouter.use(authMiddleware);

function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// POST /api/pos/orders - Fast Counter Checkout
posRouter.post('/orders', requireRole('OWNER', 'ADMIN', 'BRANCH_MANAGER', 'CASHIER'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const schema = z.object({
      branchId: z.string().optional(),
      businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
      paymentMethod: z.enum(['CASH', 'CBE', 'TELEBIRR', 'MOBILE_BANKING', 'CREDIT']).default('CASH'),
      customerName: z.string().max(100, 'Customer name too long').optional(),
      customerPhone: z.string().max(25, 'Phone number too long').optional(),
      items: z.array(z.object({
        productId: z.string().min(1, 'Product ID is required'),
        quantity: z.number().int().positive('Quantity must be greater than 0').max(10000, 'Maximum 10,000 units per line item'),
        unitPrice: z.number().positive().optional(),
      })).min(1, 'Order must contain at least one item'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message });
    }

    // Determine active branch with zero-trust boundary
    if (parsed.data.branchId && user.role !== 'OWNER' && user.role !== 'ADMIN' && parsed.data.branchId !== user.branchId) {
      return res.status(403).json({ error: 'Forbidden: You cannot create orders for another branch.' });
    }

    let branchId = (user.role === 'OWNER' || user.role === 'ADMIN') && parsed.data.branchId
      ? parsed.data.branchId
      : user.branchId;

    if (!branchId) {
      return res.status(400).json({ error: 'No active branch assigned for this transaction.' });
    }

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true, code: true, isActive: true },
    });

    if (!branch || !branch.isActive) {
      return res.status(403).json({ error: 'Branch is not active or not found.' });
    }

    const businessDate = parsed.data.businessDate || getTodayDateString();

    // Prevent sales on future dates
    const today = getTodayDateString();
    if (businessDate > today && user.role !== 'OWNER' && user.role !== 'ADMIN') {
      return res.status(400).json({ error: 'Cannot record sales on future business dates.' });
    }

    // Deduplicate items by productId in cart
    const itemAggregator = new Map<string, { productId: string; quantity: number; requestedUnitPrice?: number }>();
    for (const rawItem of parsed.data.items) {
      const existing = itemAggregator.get(rawItem.productId);
      if (existing) {
        existing.quantity += rawItem.quantity;
      } else {
        itemAggregator.set(rawItem.productId, {
          productId: rawItem.productId,
          quantity: rawItem.quantity,
          requestedUnitPrice: rawItem.unitPrice,
        });
      }
    }
    const aggregatedItems = Array.from(itemAggregator.values());

    // Verify all products exist and are active
    const productIds = aggregatedItems.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'One or more items in the cart are invalid or no longer exist.' });
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Compute line items with Devil's Advocate price tampering protection:
    // Cashiers CANNOT arbitrarily discount unit prices in the body. Only Owner/Admin can override price.
    let totalAmount = 0;
    const itemsToCreate: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }> = [];

    const isAuthorizedForPriceOverride = user.role === 'OWNER' || user.role === 'ADMIN';

    for (const item of aggregatedItems) {
      const product = productMap.get(item.productId)!;
      if (!product.isActive) {
        return res.status(400).json({ error: `Product "${product.name}" is discontinued and cannot be sold.` });
      }

      let price = Number(product.sellingPrice);
      if (isAuthorizedForPriceOverride && item.requestedUnitPrice !== undefined) {
        price = item.requestedUnitPrice;
      }

      const subtotal = Math.round(price * item.quantity * 100) / 100;
      totalAmount += subtotal;

      itemsToCreate.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: price,
        subtotal,
      });
    }

    totalAmount = Math.round(totalAmount * 100) / 100;

    // Guard against Decimal(10, 2) overflow
    if (totalAmount > 99999999.99) {
      return res.status(400).json({ error: 'Order total exceeds maximum allowable transaction limit.' });
    }

    // Generate sequential receipt e.g. REC-MEG-20261030-0001
    const dateCompact = businessDate.replace(/-/g, '');
    const todaysSalesCount = await prisma.sale.count({
      where: {
        branchId,
        businessDate,
      },
    });

    const seq = String(todaysSalesCount + 1).padStart(4, '0');
    const receiptNumber = `REC-${branch.code}-${dateCompact}-${seq}`;

    // Execute atomic sale & stock decrement with 30s timeout
    const sale = await prisma.$transaction(
      async (tx) => {
        const createdSale = await tx.sale.create({
          data: {
            receiptNumber,
            branchId,
            cashierId: user.id,
            businessDate,
            paymentMethod: parsed.data.paymentMethod,
            totalAmount,
            customerName: parsed.data.customerName?.trim() || null,
            customerPhone: parsed.data.customerPhone?.trim() || null,
            items: {
              create: itemsToCreate,
            },
          },
          include: {
            items: {
              include: {
                product: {
                  select: { id: true, name: true, sku: true, unit: true },
                },
              },
            },
            branch: {
              select: { id: true, name: true, code: true, address: true },
            },
            cashier: {
              select: { id: true, fullName: true, phone: true },
            },
          },
        });

        // Atomically decrement shelf stock for active branch (concurrent over WAN)
        await Promise.all(
          itemsToCreate.map((item) =>
            tx.branchProductStock.upsert({
              where: { branchId_productId: { branchId, productId: item.productId } },
              update: {
                availableStock: { decrement: item.quantity },
              },
              create: {
                branchId,
                productId: item.productId,
                availableStock: -item.quantity,
              },
            })
          )
        );

        return createdSale;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    res.status(201).json({
      ...sale,
      totalAmount: Number(sale.totalAmount),
      items: sale.items.map((i) => ({
        ...i,
        unitPrice: Number(i.unitPrice),
        subtotal: Number(i.subtotal),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Checkout failed' });
  }
});

// GET /api/pos/orders/today - Cashier shift / today sales feed
posRouter.get('/orders/today', requireRole('OWNER', 'ADMIN', 'BRANCH_MANAGER', 'CASHIER'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const businessDate = (req.query.businessDate as string) || getTodayDateString();

    let branchId = user.branchId;
    if ((user.role === 'OWNER' || user.role === 'ADMIN') && req.query.branchId) {
      branchId = req.query.branchId as string;
    }

    if (!branchId && user.role !== 'OWNER' && user.role !== 'ADMIN') {
      return res.status(400).json({ error: 'No branch context available' });
    }

    const where: any = { businessDate };
    if (branchId) {
      where.branchId = branchId;
    }
    if (user.role === 'CASHIER') {
      where.cashierId = user.id;
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
        cashier: { select: { id: true, fullName: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    let totalCash = 0;
    let totalTelebirr = 0;
    let totalCbe = 0;
    let totalGross = 0;

    const formattedSales = sales.map((s) => {
      const amt = Number(s.totalAmount);
      totalGross += amt;
      if (s.paymentMethod === 'CASH') totalCash += amt;
      else if (s.paymentMethod === 'TELEBIRR') totalTelebirr += amt;
      else if (s.paymentMethod === 'CBE' || s.paymentMethod === 'MOBILE_BANKING') totalCbe += amt;

      return {
        ...s,
        totalAmount: amt,
        items: s.items.map((i) => ({
          ...i,
          unitPrice: Number(i.unitPrice),
          subtotal: Number(i.subtotal),
        })),
      };
    });

    res.json({
      businessDate,
      summary: {
        totalOrders: sales.length,
        totalGross: Math.round(totalGross * 100) / 100,
        totalCash: Math.round(totalCash * 100) / 100,
        totalTelebirr: Math.round(totalTelebirr * 100) / 100,
        totalCbe: Math.round(totalCbe * 100) / 100,
      },
      orders: formattedSales,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch sales' });
  }
});

// GET /api/pos/orders/:id - Single receipt details
posRouter.get('/orders/:id', requireRole('OWNER', 'ADMIN', 'BRANCH_MANAGER', 'CASHIER'), async (req: AuthRequest, res: Response) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, unit: true } },
          },
        },
        branch: true,
        cashier: { select: { id: true, fullName: true, phone: true } },
      },
    });

    if (!sale) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    // Zero-trust boundary: cashiers cannot inspect receipts from other branches
    if (req.user!.role === 'CASHIER' && sale.branchId !== req.user!.branchId) {
      return res.status(403).json({ error: 'Forbidden: You cannot inspect receipts from another branch.' });
    }

    res.json({
      ...sale,
      totalAmount: Number(sale.totalAmount),
      items: sale.items.map((i) => ({
        ...i,
        unitPrice: Number(i.unitPrice),
        subtotal: Number(i.subtotal),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch receipt' });
  }
});
