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
      customerName: z.string().optional(),
      customerPhone: z.string().optional(),
      items: z.array(z.object({
        productId: z.string().min(1, 'Product ID is required'),
        quantity: z.number().int().positive('Quantity must be greater than 0'),
        unitPrice: z.number().positive().optional(),
      })).min(1, 'Order must contain at least one item'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message });
    }

    // Determine active branch
    let branchId = user.branchId;
    if ((user.role === 'OWNER' || user.role === 'ADMIN') && parsed.data.branchId) {
      branchId = parsed.data.branchId;
    }

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

    // Verify all products
    const productIds = parsed.data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'One or more items in the cart are invalid or no longer exist.' });
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Compute line items and total
    let totalAmount = 0;
    const itemsToCreate: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }> = [];

    for (const item of parsed.data.items) {
      const product = productMap.get(item.productId)!;
      const price = item.unitPrice !== undefined ? item.unitPrice : Number(product.sellingPrice);
      const subtotal = price * item.quantity;
      totalAmount += subtotal;

      itemsToCreate.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: price,
        subtotal,
      });
    }

    // Generate receipt number e.g. REC-MEG-20261030-0001
    const dateCompact = businessDate.replace(/-/g, '');
    const todaysSalesCount = await prisma.sale.count({
      where: {
        branchId,
        businessDate,
      },
    });

    const seq = String(todaysSalesCount + 1).padStart(4, '0');
    const receiptNumber = `REC-${branch.code}-${dateCompact}-${seq}`;

    // Execute atomic sale & stock decrement
    const sale = await prisma.$transaction(async (tx) => {
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

      // Atomically decrement shelf stock
      for (const item of itemsToCreate) {
        await tx.branchProductStock.upsert({
          where: { branchId_productId: { branchId, productId: item.productId } },
          update: {
            availableStock: { decrement: item.quantity },
          },
          create: {
            branchId,
            productId: item.productId,
            availableStock: -item.quantity,
          },
        });
      }

      return createdSale;
    }, { timeout: 30000, maxWait: 10000 });

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

    // Compute summary stats
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
        totalGross,
        totalCash,
        totalTelebirr,
        totalCbe,
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
