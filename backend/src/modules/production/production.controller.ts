import { Router, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { authMiddleware, requireRoles, type AuthRequest } from '../../middleware/auth.js';
import { Role, Shift, BatchStatus } from '@prisma/client';

export const productionRouter = Router();

// Standard Yield Rule: 1 sack of 50kg flour = ~1,362 loaves of standard 50g bread
export const LOAVES_PER_FLOUR_SACK = 1362;
export const YIELD_ALERT_THRESHOLD = 90.0; // Efficiency below 90% triggers red warning

// 1. Production Analytics & Yield Summary
productionRouter.get(
  '/metrics',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const isGlobal = req.user!.role === Role.OWNER || req.user!.role === Role.ADMIN;
      let branchId = req.query.branchId as string | undefined;

      if (!isGlobal || !branchId) {
        branchId = req.user!.branchId || undefined;
      }

      const where: any = {};
      if (branchId) {
        where.branchId = branchId;
      }

      const batches = await prisma.productionBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      const totalBatches = batches.length;
      const totalSacks = batches.reduce((sum, b) => sum + Number(b.flourSacksUsed), 0);
      const totalLoavesBaked = batches.reduce((sum, b) => sum + b.actualLoavesBaked, 0);
      const totalExpectedLoaves = batches.reduce((sum, b) => sum + b.expectedLoaves, 0);
      const totalDamaged = batches.reduce((sum, b) => sum + b.damagedLoaves, 0);
      const flaggedCount = batches.filter((b) => b.isFlagged).length;

      const avgEfficiency =
        totalExpectedLoaves > 0
          ? Number(((totalLoavesBaked / totalExpectedLoaves) * 100).toFixed(2))
          : 100.0;

      return res.json({
        totalBatches,
        totalSacksUsed: Number(totalSacks.toFixed(2)),
        totalLoavesBaked,
        totalExpectedLoaves,
        totalDamaged,
        flaggedCount,
        averageEfficiency: avgEfficiency,
      });
    } catch (err: any) {
      console.error('Production metrics error:', err);
      return res.status(500).json({ error: 'Failed to retrieve production metrics.' });
    }
  }
);

// 2. List Baking Batches
productionRouter.get(
  '/batches',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const isGlobal = req.user!.role === Role.OWNER || req.user!.role === Role.ADMIN;
      let branchId = req.query.branchId as string | undefined;

      if (!isGlobal || !branchId) {
        branchId = req.user!.branchId || undefined;
      }

      const where: any = {};
      if (branchId) {
        where.branchId = branchId;
      }

      if (req.query.shift && Object.values(Shift).includes(req.query.shift as Shift)) {
        where.shift = req.query.shift as Shift;
      }

      if (req.query.isFlagged === 'true') {
        where.isFlagged = true;
      }

      const batches = await prisma.productionBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          baker: {
            select: { id: true, fullName: true, role: true },
          },
          branch: {
            select: { id: true, name: true, code: true, isHub: true },
          },
          product: {
            select: { id: true, name: true, sku: true },
          },
        },
      });

      return res.json({ batches });
    } catch (err: any) {
      console.error('List production batches error:', err);
      return res.status(500).json({ error: 'Failed to retrieve baking batches.' });
    }
  }
);

// 3. Record Baking Batch with 1,362 Yield Physics Engine
productionRouter.post(
  '/batches',
  authMiddleware,
  requireRoles(Role.OWNER, Role.ADMIN, Role.BRANCH_MANAGER, Role.PRODUCTION_SUPERVISOR, Role.BAKER),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        branchId,
        productId,
        flourSacksUsed,
        actualLoavesBaked,
        damagedLoaves = 0,
        shift = 'DAY',
        flagReason,
      } = req.body;

      const sacks = Number(flourSacksUsed);
      const baked = Number(actualLoavesBaked);
      const damaged = Number(damagedLoaves);

      if (isNaN(sacks) || sacks <= 0) {
        return res.status(400).json({ error: 'Flour sacks used must be a positive number.' });
      }

      if (isNaN(baked) || baked <= 0) {
        return res.status(400).json({ error: 'Actual loaves baked must be a positive number.' });
      }

      if (isNaN(damaged) || damaged < 0) {
        return res.status(400).json({ error: 'Damaged loaves cannot be negative.' });
      }

      let targetBranchId = branchId;
      if (req.user!.role === Role.BAKER || req.user!.role === Role.PRODUCTION_SUPERVISOR || req.user!.role === Role.BRANCH_MANAGER) {
        targetBranchId = req.user!.branchId || branchId;
      }

      if (!targetBranchId) {
        const hub = await prisma.branch.findFirst({ where: { isHub: true, isActive: true } });
        targetBranchId = hub?.id;
      }

      // Physics Yield Math:
      // 1 sack = 50kg flour = 1,362 standard loaves
      const flourWeightKg = Number((sacks * 50.0).toFixed(2));
      const expectedLoaves = Math.round(sacks * LOAVES_PER_FLOUR_SACK);
      const yieldEfficiency = Number(((baked / expectedLoaves) * 100).toFixed(2));

      // Flag rule: under 90% yield flags an automated red warning
      const isUnderYield = yieldEfficiency < YIELD_ALERT_THRESHOLD;
      const calculatedFlagReason = isUnderYield
        ? flagReason?.trim() || `Low yield anomaly: Actual baked output (${baked} loaves) is ${yieldEfficiency}% of expected ${expectedLoaves} loaves (Physics standard: 1,362 loaves/sack).`
        : flagReason?.trim() || null;

      // Unique batch code: BATCH-YYYYMMDD-XXXX
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const batchNumber = `BATCH-${datePart}-${randomSuffix}`;

      // Resolve product ID: if not given, default to standard bread
      let targetProductId = productId;
      if (!targetProductId) {
        const defaultBread = await prisma.product.findFirst({ where: { sku: 'BREAD-50G' } });
        targetProductId = defaultBread?.id;
      }

      const batch = await prisma.productionBatch.create({
        data: {
          batchNumber,
          branchId: targetBranchId,
          bakerId: req.user!.id,
          productId: targetProductId || null,
          flourSacksUsed: sacks,
          flourWeightKg,
          expectedLoaves,
          actualLoavesBaked: baked,
          damagedLoaves: damaged,
          yieldEfficiency,
          isFlagged: isUnderYield,
          flagReason: calculatedFlagReason,
          status: BatchStatus.COMPLETED,
          shift: shift === 'NIGHT' ? Shift.NIGHT : Shift.DAY,
        },
        include: {
          baker: {
            select: { id: true, fullName: true, role: true },
          },
          branch: {
            select: { id: true, name: true, code: true },
          },
          product: {
            select: { id: true, name: true, sku: true },
          },
        },
      });

      // Developer 1: Credit baked loaves directly to Central Hub / Branch Shelf Stock
      if (targetProductId && targetBranchId) {
        const netBaked = Math.max(0, baked - damaged);
        await prisma.branchProductStock.upsert({
          where: {
            branchId_productId: {
              branchId: targetBranchId,
              productId: targetProductId,
            },
          },
          update: {
            availableStock: { increment: netBaked },
          },
          create: {
            branchId: targetBranchId,
            productId: targetProductId,
            availableStock: netBaked,
          },
        });
      }

      return res.status(201).json({
        message: isUnderYield
          ? `Batch logged with low yield warning (${yieldEfficiency}% of expected ${expectedLoaves} loaves). Flagged for supervisor review.`
          : `Batch completed successfully. Optimal yield efficiency: ${yieldEfficiency}%.`,
        batch,
      });
    } catch (err: any) {
      console.error('Record production batch error:', err);
      return res.status(500).json({ error: 'Failed to record baking batch.' });
    }
  }
);
