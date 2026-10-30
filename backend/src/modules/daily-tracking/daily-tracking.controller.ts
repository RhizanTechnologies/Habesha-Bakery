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

    // Prevent non-admin users from probing future closeouts
    const today = getTodayDateString();
    if (businessDate > today && user.role !== 'OWNER' && user.role !== 'ADMIN') {
      return res.status(400).json({ error: 'Cannot query closeout summary for future business dates.' });
    }

    const requestedBranchId = req.query.branchId as string | undefined;

    // Zero-trust check: cashiers and non-admins CANNOT query another branch
    if (requestedBranchId && user.role !== 'OWNER' && user.role !== 'ADMIN' && requestedBranchId !== user.branchId) {
      return res.status(403).json({ error: 'Forbidden: You cannot view closeout summary for another branch.' });
    }

    const branchId = (user.role === 'OWNER' || user.role === 'ADMIN') && requestedBranchId
      ? requestedBranchId
      : user.branchId;

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

    const totalDigitalSales = Math.round((totalTelebirrSales + totalCbeSales) * 100) / 100;
    const totalGrossSales = Math.round((totalCashSales + totalDigitalSales + totalCreditSales) * 100) / 100;

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
      totalCashSales: Math.round(totalCashSales * 100) / 100,
      totalTelebirrSales: Math.round(totalTelebirrSales * 100) / 100,
      totalCbeSales: Math.round(totalCbeSales * 100) / 100,
      totalDigitalSales,
      totalCreditSales: Math.round(totalCreditSales * 100) / 100,
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
      startingFloat: z.number().nonnegative('Starting float must be 0 or greater').max(1000000).default(0),
      actualCountedCash: z.number().nonnegative('Counted cash must be 0 or greater').max(10000000),
      totalExpenses: z.number().nonnegative('Expenses must be 0 or greater').max(1000000).default(0),
      notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message });
    }

    // Zero-trust check: cashiers and non-admins CANNOT close out another branch
    if (parsed.data.branchId && user.role !== 'OWNER' && user.role !== 'ADMIN' && parsed.data.branchId !== user.branchId) {
      return res.status(403).json({ error: 'Forbidden: You cannot submit closeout for another branch.' });
    }

    const branchId = (user.role === 'OWNER' || user.role === 'ADMIN') && parsed.data.branchId
      ? parsed.data.branchId
      : user.branchId;

    if (!branchId) {
      return res.status(400).json({ error: 'No branch context available' });
    }

    const businessDate = parsed.data.businessDate || getTodayDateString();

    // Prevent non-admin users from submitting future closeouts
    const today = getTodayDateString();
    if (businessDate > today && user.role !== 'OWNER' && user.role !== 'ADMIN') {
      return res.status(400).json({ error: 'Cannot submit closeout for future business dates.' });
    }

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

    totalCashSales = Math.round(totalCashSales * 100) / 100;
    totalDigitalSales = Math.round(totalDigitalSales * 100) / 100;

    // Mathematical formula from legacy specification:
    // expectedCash = startingFloat + totalCashSales - totalExpenses
    // variance = actualCountedCash - expectedCash
    const expectedCash = Math.round((parsed.data.startingFloat + totalCashSales - parsed.data.totalExpenses) * 100) / 100;
    const variance = Math.round((parsed.data.actualCountedCash - expectedCash) * 100) / 100;

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
    const requestedBranchId = req.query.branchId as string | undefined;

    // Zero-trust check: non-admin CANNOT view another branch's closeout history
    if (requestedBranchId && user.role !== 'OWNER' && user.role !== 'ADMIN' && requestedBranchId !== user.branchId) {
      return res.status(403).json({ error: 'Forbidden: You cannot view closeout history for another branch.' });
    }

    let branchId = (user.role === 'OWNER' || user.role === 'ADMIN') && requestedBranchId
      ? requestedBranchId
      : user.branchId;

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
