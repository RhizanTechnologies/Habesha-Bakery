import { Router, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { authMiddleware, requireRole, type AuthRequest } from '../../middleware/auth.js';
import { z } from 'zod';

export const dailyTrackingRouter = Router();
dailyTrackingRouter.use(authMiddleware);

function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// GET /api/daily-tracking/summary - Aggregate today's sales & drawer reconciliation figures
dailyTrackingRouter.get('/summary', requireRole('OWNER', 'ADMIN', 'BRANCH_MANAGER', 'CASHIER'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const businessDate = (req.query.businessDate as string) || getTodayDateString();

    let branchId = user.branchId;
    if ((user.role === 'OWNER' || user.role === 'ADMIN') && req.query.branchId) {
      branchId = req.query.branchId as string;
    }

    if (!branchId) {
      return res.status(400).json({ error: 'Branch context is required for daily tracking summary' });
    }

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true, code: true },
    });

    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    // Fetch all sales for this branch and date
    const sales = await prisma.sale.findMany({
      where: {
        branchId,
        businessDate,
      },
      select: {
        totalAmount: true,
        paymentMethod: true,
      },
    });

    let totalCashSales = 0;
    let totalTelebirrSales = 0;
    let totalCbeSales = 0;
    let totalCreditSales = 0;

    for (const s of sales) {
      const amt = Number(s.totalAmount);
      if (s.paymentMethod === 'CASH') totalCashSales += amt;
      else if (s.paymentMethod === 'TELEBIRR') totalTelebirrSales += amt;
      else if (s.paymentMethod === 'CBE' || s.paymentMethod === 'MOBILE_BANKING') totalCbeSales += amt;
      else if (s.paymentMethod === 'CREDIT') totalCreditSales += amt;
    }

    const totalDigitalSales = totalTelebirrSales + totalCbeSales;
    const totalGrossSales = totalCashSales + totalDigitalSales + totalCreditSales;

    // Check existing closeout
    const existingCloseout = await prisma.dailyCashTracking.findUnique({
      where: {
        branchId_businessDate: {
          branchId,
          businessDate,
        },
      },
      include: {
        submittedByUser: { select: { id: true, fullName: true, phone: true } },
      },
    });

    res.json({
      branch,
      businessDate,
      totalOrders: sales.length,
      totalCashSales,
      totalTelebirrSales,
      totalCbeSales,
      totalDigitalSales,
      totalCreditSales,
      totalGrossSales,
      closeout: existingCloseout
        ? {
            ...existingCloseout,
            startingFloat: Number(existingCloseout.startingFloat),
            totalCashSales: Number(existingCloseout.totalCashSales),
            totalDigitalSales: Number(existingCloseout.totalDigitalSales),
            totalExpenses: Number(existingCloseout.totalExpenses),
            expectedCash: Number(existingCloseout.expectedCash),
            actualCountedCash: Number(existingCloseout.actualCountedCash),
            variance: Number(existingCloseout.variance),
          }
        : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch daily tracking summary' });
  }
});

// POST /api/daily-tracking/closeout - Submit drawer cash reconciliation
dailyTrackingRouter.post('/closeout', requireRole('OWNER', 'ADMIN', 'BRANCH_MANAGER', 'CASHIER'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const schema = z.object({
      branchId: z.string().optional(),
      businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
      startingFloat: z.number().nonnegative('Starting float must be 0 or greater').default(0),
      actualCountedCash: z.number().nonnegative('Counted cash must be 0 or greater'),
      totalExpenses: z.number().nonnegative('Expenses must be 0 or greater').default(0),
      notes: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message });
    }

    let branchId = user.branchId;
    if ((user.role === 'OWNER' || user.role === 'ADMIN') && parsed.data.branchId) {
      branchId = parsed.data.branchId;
    }

    if (!branchId) {
      return res.status(400).json({ error: 'No branch context available' });
    }

    const businessDate = parsed.data.businessDate || getTodayDateString();

    // Calculate actual total cash sales from recorded orders
    const sales = await prisma.sale.findMany({
      where: {
        branchId,
        businessDate,
      },
      select: {
        totalAmount: true,
        paymentMethod: true,
      },
    });

    let totalCashSales = 0;
    let totalDigitalSales = 0;

    for (const s of sales) {
      const amt = Number(s.totalAmount);
      if (s.paymentMethod === 'CASH') totalCashSales += amt;
      else if (s.paymentMethod === 'TELEBIRR' || s.paymentMethod === 'CBE' || s.paymentMethod === 'MOBILE_BANKING') {
        totalDigitalSales += amt;
      }
    }

    // Mathematical formula from legacy specification:
    // expectedCash = startingFloat + totalCashSales - totalExpenses
    // variance = actualCountedCash - expectedCash
    const expectedCash = parsed.data.startingFloat + totalCashSales - parsed.data.totalExpenses;
    const variance = parsed.data.actualCountedCash - expectedCash;

    const closeout = await prisma.dailyCashTracking.upsert({
      where: {
        branchId_businessDate: {
          branchId,
          businessDate,
        },
      },
      update: {
        startingFloat: parsed.data.startingFloat,
        totalCashSales,
        totalDigitalSales,
        totalExpenses: parsed.data.totalExpenses,
        expectedCash,
        actualCountedCash: parsed.data.actualCountedCash,
        variance,
        submittedByUserId: user.id,
        notes: parsed.data.notes?.trim() || null,
      },
      create: {
        branchId,
        businessDate,
        startingFloat: parsed.data.startingFloat,
        totalCashSales,
        totalDigitalSales,
        totalExpenses: parsed.data.totalExpenses,
        expectedCash,
        actualCountedCash: parsed.data.actualCountedCash,
        variance,
        submittedByUserId: user.id,
        notes: parsed.data.notes?.trim() || null,
      },
      include: {
        submittedByUser: { select: { id: true, fullName: true, phone: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    res.status(200).json({
      ...closeout,
      startingFloat: Number(closeout.startingFloat),
      totalCashSales: Number(closeout.totalCashSales),
      totalDigitalSales: Number(closeout.totalDigitalSales),
      totalExpenses: Number(closeout.totalExpenses),
      expectedCash: Number(closeout.expectedCash),
      actualCountedCash: Number(closeout.actualCountedCash),
      variance: Number(closeout.variance),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to submit closeout' });
  }
});

// GET /api/daily-tracking/history - Audit log of daily reconciliations
dailyTrackingRouter.get('/history', requireRole('OWNER', 'ADMIN', 'BRANCH_MANAGER', 'CASHIER'), async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    let branchId = user.branchId;
    if ((user.role === 'OWNER' || user.role === 'ADMIN') && req.query.branchId) {
      branchId = req.query.branchId as string;
    }

    const where: any = {};
    if (branchId) {
      where.branchId = branchId;
    }

    const records = await prisma.dailyCashTracking.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, code: true } },
        submittedByUser: { select: { id: true, fullName: true, phone: true } },
      },
      orderBy: { businessDate: 'desc' },
      take: 60,
    });

    res.json(records.map((r) => ({
      ...r,
      startingFloat: Number(r.startingFloat),
      totalCashSales: Number(r.totalCashSales),
      totalDigitalSales: Number(r.totalDigitalSales),
      totalExpenses: Number(r.totalExpenses),
      expectedCash: Number(r.expectedCash),
      actualCountedCash: Number(r.actualCountedCash),
      variance: Number(r.variance),
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch history' });
  }
});
