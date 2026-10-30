import { Router, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { authMiddleware, requireRole, type AuthRequest } from '../../middleware/auth.js';
import { z } from 'zod';

export const productsRouter = Router();
productsRouter.use(authMiddleware);

// GET /api/products/categories - List product categories
productsRouter.get('/categories', async (_req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.productCategory.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch categories' });
  }
});

// POST /api/products/categories - Create category
productsRouter.post('/categories', requireRole('OWNER', 'ADMIN', 'BRANCH_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(2, 'Category name must be at least 2 characters'),
      description: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message });
    }

    const existing = await prisma.productCategory.findUnique({
      where: { name: parsed.data.name.trim() },
    });
    if (existing) {
      return res.status(409).json({ error: 'A category with this name already exists' });
    }

    const category = await prisma.productCategory.create({
      data: {
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim(),
      },
    });
    res.status(201).json(category);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create category' });
  }
});

// GET /api/products - List products with shelf stock
productsRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const search = (req.query.search as string)?.trim();
    const categoryId = req.query.categoryId as string | undefined;
    const isActiveParam = req.query.isActive as string | undefined;
    const isActive = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined;

    // Determine target branch for stock querying
    let branchId = req.query.branchId as string | undefined;
    if (user.role === 'CASHIER' || user.role === 'STOREKEEPER' || user.role === 'BAKER') {
      branchId = user.branchId || undefined;
    } else if (!branchId && user.branchId) {
      branchId = user.branchId;
    }

    const where: any = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        branchStocks: branchId
          ? {
              where: { branchId },
              include: { branch: { select: { id: true, name: true, code: true } } },
            }
          : {
              include: { branch: { select: { id: true, name: true, code: true } } },
            },
      },
      orderBy: { name: 'asc' },
    });

    const enriched = products.map((p) => {
      const stock = branchId
        ? p.branchStocks.find((s) => s.branchId === branchId)?.availableStock ?? 0
        : p.branchStocks.reduce((sum, s) => sum + s.availableStock, 0);

      return {
        ...p,
        sellingPrice: Number(p.sellingPrice),
        costPrice: p.costPrice ? Number(p.costPrice) : null,
        availableStock: stock,
      };
    });

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch products' });
  }
});

// GET /api/products/:id - Single product details
productsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        branchStocks: {
          include: { branch: { select: { id: true, name: true, code: true } } },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const branchId = (user.role === 'CASHIER' || user.role === 'STOREKEEPER' || user.role === 'BAKER')
      ? user.branchId
      : (req.query.branchId as string) || user.branchId;

    const availableStock = branchId
      ? product.branchStocks.find((s) => s.branchId === branchId)?.availableStock ?? 0
      : product.branchStocks.reduce((sum, s) => sum + s.availableStock, 0);

    res.json({
      ...product,
      sellingPrice: Number(product.sellingPrice),
      costPrice: product.costPrice ? Number(product.costPrice) : null,
      availableStock,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch product' });
  }
});

// POST /api/products - Create new product
productsRouter.post('/', requireRole('OWNER', 'ADMIN', 'BRANCH_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(2, 'Name must be at least 2 characters'),
      sku: z.string().min(2, 'SKU must be at least 2 characters'),
      sellingPrice: z.number().positive('Selling price must be greater than 0'),
      costPrice: z.number().positive().optional(),
      categoryId: z.string().min(1, 'Category is required'),
      unit: z.string().default('PIECE'),
      isActive: z.boolean().default(true),
      initialStock: z.number().int().nonnegative().optional().default(0),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message });
    }

    const existingSku = await prisma.product.findUnique({
      where: { sku: parsed.data.sku.trim().toUpperCase() },
    });
    if (existingSku) {
      return res.status(409).json({ error: 'A product with this SKU already exists' });
    }

    // Verify category
    const category = await prisma.productCategory.findUnique({
      where: { id: parsed.data.categoryId },
    });
    if (!category) {
      return res.status(400).json({ error: 'Invalid product category' });
    }

    // Create product
    const product = await prisma.product.create({
      data: {
        name: parsed.data.name.trim(),
        sku: parsed.data.sku.trim().toUpperCase(),
        sellingPrice: parsed.data.sellingPrice,
        costPrice: parsed.data.costPrice ?? null,
        categoryId: parsed.data.categoryId,
        unit: parsed.data.unit.trim().toUpperCase(),
        isActive: parsed.data.isActive,
      },
    });

    // Auto-initialize stock across all active branches
    const branches = await prisma.branch.findMany({ where: { isActive: true }, select: { id: true } });
    const targetBranchId = req.user!.branchId || branches[0]?.id;

    for (const b of branches) {
      await prisma.branchProductStock.upsert({
        where: { branchId_productId: { branchId: b.id, productId: product.id } },
        update: {},
        create: {
          branchId: b.id,
          productId: product.id,
          availableStock: b.id === targetBranchId ? parsed.data.initialStock : 0,
        },
      });
    }

    res.status(201).json({
      ...product,
      sellingPrice: Number(product.sellingPrice),
      costPrice: product.costPrice ? Number(product.costPrice) : null,
      availableStock: parsed.data.initialStock,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create product' });
  }
});

// PATCH /api/products/:id - Update product
productsRouter.patch('/:id', requireRole('OWNER', 'ADMIN', 'BRANCH_MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      name: z.string().min(2).optional(),
      sku: z.string().min(2).optional(),
      sellingPrice: z.number().positive().optional(),
      costPrice: z.number().positive().nullable().optional(),
      categoryId: z.string().optional(),
      unit: z.string().optional(),
      isActive: z.boolean().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message });
    }

    const data: any = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
    if (parsed.data.sku !== undefined) data.sku = parsed.data.sku.trim().toUpperCase();
    if (parsed.data.sellingPrice !== undefined) data.sellingPrice = parsed.data.sellingPrice;
    if (parsed.data.costPrice !== undefined) data.costPrice = parsed.data.costPrice;
    if (parsed.data.categoryId !== undefined) data.categoryId = parsed.data.categoryId;
    if (parsed.data.unit !== undefined) data.unit = parsed.data.unit.trim().toUpperCase();
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data,
      include: { category: true },
    });

    res.json({
      ...product,
      sellingPrice: Number(product.sellingPrice),
      costPrice: product.costPrice ? Number(product.costPrice) : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update product' });
  }
});

// PATCH /api/products/:id/stock - Adjust shelf stock for a branch
productsRouter.patch('/:id/stock', requireRole('OWNER', 'ADMIN', 'BRANCH_MANAGER', 'STOREKEEPER'), async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      branchId: z.string().optional(),
      availableStock: z.number().int().nonnegative(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message });
    }

    const branchId = parsed.data.branchId || req.user!.branchId;
    if (!branchId) {
      return res.status(400).json({ error: 'Branch ID is required to adjust stock' });
    }

    const stock = await prisma.branchProductStock.upsert({
      where: { branchId_productId: { branchId, productId: req.params.id } },
      update: { availableStock: parsed.data.availableStock },
      create: {
        branchId,
        productId: req.params.id,
        availableStock: parsed.data.availableStock,
      },
    });

    res.json(stock);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update branch stock' });
  }
});
