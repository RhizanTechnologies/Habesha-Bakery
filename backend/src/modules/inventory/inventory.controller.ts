import { Router, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { authMiddleware, requireRoles, type AuthRequest } from '../../middleware/auth.js';
import { Role } from '@prisma/client';

export const inventoryRouter = Router();

// 1. List all raw material catalog definitions
inventoryRouter.get(
  '/materials',
  authMiddleware,
  async (_req: AuthRequest, res: Response) => {
    try {
      const materials = await prisma.rawMaterial.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
      return res.json({ materials });
    } catch (err: any) {
      console.error('List materials error:', err);
      return res.status(500).json({ error: 'Failed to retrieve raw materials catalog.' });
    }
  }
);

// 2. Get Raw Material Stock for a Branch (Defaults to Central Hub or active branch)
inventoryRouter.get(
  '/stock',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const isGlobal = req.user!.role === Role.OWNER || req.user!.role === Role.ADMIN;
      let branchId = req.query.branchId as string | undefined;

      if (!isGlobal || !branchId) {
        branchId = req.user!.branchId || undefined;
      }

      // If still no branch specified (e.g. Owner without query param), default to Central Hub
      if (!branchId) {
        const hub = await prisma.branch.findFirst({ where: { isHub: true, isActive: true } });
        branchId = hub?.id;
      }

      if (!branchId) {
        return res.status(400).json({ error: 'Branch ID is required.' });
      }

      // Fetch all active materials and their stock at this branch
      const materials = await prisma.rawMaterial.findMany({
        where: { isActive: true },
        include: {
          stocks: {
            where: { branchId },
          },
        },
        orderBy: { name: 'asc' },
      });

      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { id: true, name: true, code: true, isHub: true },
      });

      const stockItems = materials.map((m) => {
        const stockRecord = m.stocks[0];
        const currentQty = stockRecord ? Number(stockRecord.quantity) : 0;
        const minThreshold = Number(m.minStockThreshold);
        const isLowStock = currentQty <= minThreshold;

        return {
          id: m.id,
          name: m.name,
          sku: m.sku,
          unit: m.unit,
          packageWeightKg: m.packageWeightKg ? Number(m.packageWeightKg) : null,
          minStockThreshold: minThreshold,
          costPerUnit: m.costPerUnit ? Number(m.costPerUnit) : null,
          currentQuantity: currentQty,
          isLowStock,
          updatedAt: stockRecord?.updatedAt || m.updatedAt,
        };
      });

      return res.json({
        branch,
        stocks: stockItems,
      });
    } catch (err: any) {
      console.error('Fetch inventory stock error:', err);
      return res.status(500).json({ error: 'Failed to retrieve inventory stock balances.' });
    }
  }
);

// 3. Receive Supplier Delivery (Ingest raw materials into warehouse)
inventoryRouter.post(
  '/ingest',
  authMiddleware,
  requireRoles(Role.OWNER, Role.ADMIN, Role.BRANCH_MANAGER, Role.STOREKEEPER),
  async (req: AuthRequest, res: Response) => {
    try {
      const { branchId, rawMaterialId, quantity, notes } = req.body;

      if (!rawMaterialId || quantity === undefined) {
        return res.status(400).json({ error: 'Raw material and delivery quantity are required.' });
      }

      const parsedQty = Number(quantity);
      if (isNaN(parsedQty) || parsedQty <= 0) {
        return res.status(400).json({ error: 'Delivery quantity must be a positive number.' });
      }

      let targetBranchId = branchId;
      if (req.user!.role === Role.STOREKEEPER || req.user!.role === Role.BRANCH_MANAGER) {
        targetBranchId = req.user!.branchId || branchId;
      }

      if (!targetBranchId) {
        const hub = await prisma.branch.findFirst({ where: { isHub: true, isActive: true } });
        targetBranchId = hub?.id;
      }

      const material = await prisma.rawMaterial.findUnique({ where: { id: rawMaterialId } });
      if (!material) {
        return res.status(404).json({ error: 'Raw material not found.' });
      }

      const updatedStock = await prisma.rawMaterialStock.upsert({
        where: {
          branchId_rawMaterialId: {
            branchId: targetBranchId,
            rawMaterialId,
          },
        },
        update: {
          quantity: { increment: parsedQty },
        },
        create: {
          branchId: targetBranchId,
          rawMaterialId,
          quantity: parsedQty,
        },
      });

      return res.status(201).json({
        message: `Successfully received ${parsedQty} ${material.unit} of ${material.name} into warehouse.`,
        stock: {
          materialId: material.id,
          name: material.name,
          currentQuantity: Number(updatedStock.quantity),
          unit: material.unit,
        },
      });
    } catch (err: any) {
      console.error('Ingest material error:', err);
      return res.status(500).json({ error: 'Failed to record supplier intake.' });
    }
  }
);

// 4. Scale Disbursement: Weigh-out materials from warehouse to kitchen
inventoryRouter.post(
  '/disburse',
  authMiddleware,
  requireRoles(Role.OWNER, Role.ADMIN, Role.BRANCH_MANAGER, Role.STOREKEEPER),
  async (req: AuthRequest, res: Response) => {
    try {
      const { branchId, department = 'KITCHEN', notes, items } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'At least one material item must be weighed out.' });
      }

      let targetBranchId = branchId;
      if (req.user!.role === Role.STOREKEEPER || req.user!.role === Role.BRANCH_MANAGER) {
        targetBranchId = req.user!.branchId || branchId;
      }

      if (!targetBranchId) {
        const hub = await prisma.branch.findFirst({ where: { isHub: true, isActive: true } });
        targetBranchId = hub?.id;
      }

      // 1. Pre-validation: check stock availability for all items to prevent negative balances
      for (const item of items) {
        const qty = Number(item.quantity);
        if (isNaN(qty) || qty <= 0) {
          return res.status(400).json({ error: 'Each weighed item must have a positive quantity.' });
        }

        const stock = await prisma.rawMaterialStock.findUnique({
          where: {
            branchId_rawMaterialId: {
              branchId: targetBranchId,
              rawMaterialId: item.rawMaterialId,
            },
          },
          include: { rawMaterial: true },
        });

        const currentQty = stock ? Number(stock.quantity) : 0;
        const matName = stock?.rawMaterial?.name || 'Material';

        if (currentQty < qty) {
          return res.status(400).json({
            error: `Insufficient warehouse stock for ${matName}. Available: ${currentQty}, Requested: ${qty}`,
          });
        }
      }

      // 2. Atomic Transaction: Decrement stock and record disbursement manifest
      const result = await prisma.$transaction(async (tx) => {
        const disbursement = await tx.materialDisbursement.create({
          data: {
            fromBranchId: targetBranchId,
            disbursedByUserId: req.user!.id,
            department,
            notes,
          },
        });

        const createdItems = [];
        for (const item of items) {
          const qty = Number(item.quantity);

          // Decrement stock
          await tx.rawMaterialStock.update({
            where: {
              branchId_rawMaterialId: {
                branchId: targetBranchId,
                rawMaterialId: item.rawMaterialId,
              },
            },
            data: {
              quantity: { decrement: qty },
            },
          });

          // Fetch material unit
          const mat = await tx.rawMaterial.findUnique({
            where: { id: item.rawMaterialId },
            select: { name: true, unit: true },
          });

          const disItem = await tx.materialDisbursementItem.create({
            data: {
              disbursementId: disbursement.id,
              rawMaterialId: item.rawMaterialId,
              quantity: qty,
              unit: mat?.unit || 'KG',
            },
          });

          createdItems.push({
            id: disItem.id,
            materialName: mat?.name,
            quantity: qty,
            unit: mat?.unit,
          });
        }

        return { disbursement, items: createdItems };
      });

      return res.status(201).json({
        message: 'Scale disbursement completed successfully. Materials issued to kitchen.',
        disbursement: {
          id: result.disbursement.id,
          department: result.disbursement.department,
          disbursedAt: result.disbursement.createdAt,
          items: result.items,
        },
      });
    } catch (err: any) {
      console.error('Disbursement error:', err);
      return res.status(500).json({ error: 'Failed to complete material disbursement.' });
    }
  }
);

// 5. List Recent Material Disbursements
inventoryRouter.get(
  '/disbursements',
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
        where.fromBranchId = branchId;
      }

      const disbursements = await prisma.materialDisbursement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          disbursedByUser: {
            select: { id: true, fullName: true, role: true },
          },
          fromBranch: {
            select: { id: true, name: true, code: true },
          },
          items: {
            include: {
              rawMaterial: { select: { id: true, name: true, unit: true } },
            },
          },
        },
      });

      return res.json({ disbursements });
    } catch (err: any) {
      console.error('List disbursements error:', err);
      return res.status(500).json({ error: 'Failed to retrieve disbursement records.' });
    }
  }
);
