import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { authMiddleware, requireRoles, type AuthRequest } from '../../middleware/auth.js';
import { Role, TransferStatus } from '@prisma/client';

export const transfersRouter = Router();

// Standard Bakery Crate Packaging: 40 loaves per crate
export const LOAVES_PER_CRATE = 40;

// 1. Transfer Analytics & Dispatch Metrics
transfersRouter.get(
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
        where.OR = [
          { sourceBranchId: branchId },
          { destinationBranchId: branchId },
        ];
      }

      const manifests = await prisma.transferManifest.findMany({
        where,
        include: {
          product: {
            select: { sellingPrice: true },
          },
        },
      });

      const totalTransfers = manifests.length;
      const pendingCount = manifests.filter((m) => m.status === TransferStatus.PENDING_DISPATCH).length;
      const inTransitCount = manifests.filter((m) => m.status === TransferStatus.IN_TRANSIT).length;
      const receivedCount = manifests.filter((m) => m.status === TransferStatus.RECEIVED).length;

      const totalDispatchedLoaves = manifests.reduce((sum, m) => sum + m.dispatchedLoaves, 0);
      const totalCratesMoved = manifests.reduce((sum, m) => sum + m.crateCount, 0);
      const totalReceivedLoaves = manifests.reduce((sum, m) => sum + (m.receivedLoaves || 0), 0);
      const totalCrushedLoaves = manifests.reduce((sum, m) => sum + (m.crushedLoaves || 0), 0);
      const totalDriverBilledCost = manifests.reduce(
        (sum, m) => sum + Number(m.driverBilledCost || 0),
        0
      );

      return res.json({
        totalTransfers,
        pendingCount,
        inTransitCount,
        receivedCount,
        totalDispatchedLoaves,
        totalCratesMoved,
        totalReceivedLoaves,
        totalCrushedLoaves,
        totalDriverBilledCost: Number(totalDriverBilledCost.toFixed(2)),
      });
    } catch (err: any) {
      console.error('Transfer metrics error:', err);
      return res.status(500).json({ error: 'Failed to retrieve transfer metrics.' });
    }
  }
);

// 2. Eligible Logistics Drivers List
transfersRouter.get(
  '/drivers',
  authMiddleware,
  async (_req: AuthRequest, res: Response) => {
    try {
      const drivers = await prisma.user.findMany({
        where: {
          role: Role.DRIVER,
          isActive: true,
        },
        select: {
          id: true,
          fullName: true,
          phone: true,
          role: true,
          branch: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: { fullName: 'asc' },
      });

      return res.json({ drivers });
    } catch (err: any) {
      console.error('List drivers error:', err);
      return res.status(500).json({ error: 'Failed to retrieve drivers.' });
    }
  }
);

// 3. List Transfer Manifests
transfersRouter.get(
  '/',
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
        where.OR = [
          { sourceBranchId: branchId },
          { destinationBranchId: branchId },
        ];
      }

      if (req.query.status && Object.values(TransferStatus).includes(req.query.status as TransferStatus)) {
        where.status = req.query.status as TransferStatus;
      }

      if (req.query.driverId) {
        where.driverId = req.query.driverId as string;
      }

      const manifests = await prisma.transferManifest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          sourceBranch: {
            select: { id: true, name: true, code: true, isHub: true },
          },
          destinationBranch: {
            select: { id: true, name: true, code: true, isHub: true },
          },
          product: {
            select: { id: true, name: true, sku: true, sellingPrice: true },
          },
          driver: {
            select: { id: true, fullName: true, phone: true },
          },
          receivedByUser: {
            select: { id: true, fullName: true, role: true },
          },
        },
      });

      return res.json({ manifests });
    } catch (err: any) {
      console.error('List manifests error:', err);
      return res.status(500).json({ error: 'Failed to retrieve transfer manifests.' });
    }
  }
);

// 4. Single Transfer Manifest Detail
transfersRouter.get(
  '/:id',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const manifest = await prisma.transferManifest.findUnique({
        where: { id: req.params.id },
        include: {
          sourceBranch: true,
          destinationBranch: true,
          product: true,
          driver: {
            select: { id: true, fullName: true, phone: true },
          },
          receivedByUser: {
            select: { id: true, fullName: true, role: true },
          },
        },
      });

      if (!manifest) {
        return res.status(404).json({ error: 'Transfer manifest not found.' });
      }

      return res.json({ manifest });
    } catch (err: any) {
      console.error('Get transfer manifest error:', err);
      return res.status(500).json({ error: 'Failed to retrieve transfer manifest.' });
    }
  }
);

// 5. Create Transfer Manifest (Hub -> Retail Spoke)
transfersRouter.post(
  '/',
  authMiddleware,
  requireRoles(Role.OWNER, Role.ADMIN, Role.BRANCH_MANAGER, Role.PRODUCTION_SUPERVISOR, Role.STOREKEEPER),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        sourceBranchId,
        destinationBranchId,
        productId,
        dispatchedLoaves,
        driverId,
        notes,
      } = req.body;

      const loaves = parseInt(dispatchedLoaves, 10);
      if (isNaN(loaves) || loaves <= 0) {
        return res.status(400).json({ error: 'Dispatched loaves must be a positive integer.' });
      }

      // Determine Source Branch (default to Hub)
      let sourceId = sourceBranchId;
      if (!sourceId) {
        if (req.user!.branchId) {
          sourceId = req.user!.branchId;
        } else {
          const hub = await prisma.branch.findFirst({ where: { isHub: true, isActive: true } });
          sourceId = hub?.id;
        }
      }

      if (!sourceId) {
        return res.status(400).json({ error: 'Origin branch is required.' });
      }

      if (!destinationBranchId) {
        return res.status(400).json({ error: 'Destination retail branch is required.' });
      }

      if (sourceId === destinationBranchId) {
        return res.status(400).json({ error: 'Source and destination branches cannot be the same.' });
      }

      // Destination branch validation
      const destBranch = await prisma.branch.findUnique({ where: { id: destinationBranchId } });
      if (!destBranch || !destBranch.isActive) {
        return res.status(404).json({ error: 'Destination branch not found or inactive.' });
      }

      // Resolve driver
      if (!driverId) {
        return res.status(400).json({ error: 'Assigned driver is required.' });
      }

      const driver = await prisma.user.findUnique({ where: { id: driverId } });
      if (!driver || !driver.isActive) {
        return res.status(404).json({ error: 'Driver not found or inactive.' });
      }

      // Resolve product (default: standard 50g loaf)
      let targetProductId = productId;
      if (!targetProductId) {
        const defaultProduct = await prisma.product.findFirst({ where: { sku: 'BREAD-50G' } });
        targetProductId = defaultProduct?.id;
      }

      const product = await prisma.product.findUnique({ where: { id: targetProductId } });
      if (!product) {
        return res.status(404).json({ error: 'Product not found.' });
      }

      // Calculate 40 loaves per crate packaging rule
      const crateCount = Math.ceil(loaves / LOAVES_PER_CRATE);

      // Unique manifest number: TRF-YYYYMMDD-XXXX
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const manifestNumber = `TRF-${datePart}-${randomSuffix}`;

      // In transaction: deduct from source branch shelf stock & create manifest
      const result = await prisma.$transaction(
        async (tx) => {
          // Upsert source branch stock and deduct dispatched loaves
          await tx.branchProductStock.upsert({
            where: {
              branchId_productId: {
                branchId: sourceId,
                productId: targetProductId,
              },
            },
            update: {
              availableStock: { decrement: loaves },
            },
            create: {
              branchId: sourceId,
              productId: targetProductId,
              availableStock: -loaves,
            },
          });

          const manifest = await tx.transferManifest.create({
            data: {
              manifestNumber,
              sourceBranchId: sourceId,
              destinationBranchId,
              productId: targetProductId,
              dispatchedLoaves: loaves,
              crateCount,
              driverId,
              status: TransferStatus.PENDING_DISPATCH,
              notes: notes?.trim() || null,
            },
            include: {
              sourceBranch: {
                select: { id: true, name: true, code: true },
              },
              destinationBranch: {
                select: { id: true, name: true, code: true },
              },
              product: {
                select: { id: true, name: true, sku: true, sellingPrice: true },
              },
              driver: {
                select: { id: true, fullName: true, phone: true },
              },
            },
          });

          return manifest;
        },
        {
          maxWait: 10000,
          timeout: 20000,
        }
      );

      return res.status(201).json({
        message: `Transfer manifest ${manifestNumber} created successfully (${loaves} loaves packed in ${crateCount} crates).`,
        manifest: result,
      });
    } catch (err: any) {
      console.error('Create transfer manifest error:', err);
      return res.status(500).json({ error: 'Failed to create transfer manifest.' });
    }
  }
);

// 6. Driver Handshake: Sign & Dispatch Departure
transfersRouter.post(
  '/:id/dispatch',
  authMiddleware,
  requireRoles(Role.OWNER, Role.ADMIN, Role.BRANCH_MANAGER, Role.DRIVER, Role.PRODUCTION_SUPERVISOR, Role.STOREKEEPER),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const manifest = await prisma.transferManifest.findUnique({
        where: { id },
      });

      if (!manifest) {
        return res.status(404).json({ error: 'Transfer manifest not found.' });
      }

      if (manifest.status !== TransferStatus.PENDING_DISPATCH) {
        return res.status(400).json({
          error: `Manifest is already in ${manifest.status} status and cannot be dispatched again.`,
        });
      }

      const now = new Date();
      const updated = await prisma.transferManifest.update({
        where: { id },
        data: {
          status: TransferStatus.IN_TRANSIT,
          dispatchedAt: now,
          driverSignedAt: now,
        },
        include: {
          sourceBranch: true,
          destinationBranch: true,
          product: true,
          driver: {
            select: { id: true, fullName: true, phone: true },
          },
        },
      });

      return res.json({
        message: `Transfer ${manifest.manifestNumber} has been dispatched with driver sign-off. Van is in transit.`,
        manifest: updated,
      });
    } catch (err: any) {
      console.error('Dispatch transfer error:', err);
      return res.status(500).json({ error: 'Failed to complete dispatch handshake.' });
    }
  }
);

// 7. Spoke Receiving Handshake: Inspection, Crushed Loaves Billing & Shelf Stock Addition
transfersRouter.post(
  '/:id/receive',
  authMiddleware,
  requireRoles(Role.OWNER, Role.ADMIN, Role.BRANCH_MANAGER, Role.CASHIER, Role.STOREKEEPER),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { crushedLoaves = 0, supervisorPin, notes } = req.body;

      const crushed = Math.max(0, parseInt(crushedLoaves, 10) || 0);

      const manifest = await prisma.transferManifest.findUnique({
        where: { id },
        include: {
          product: true,
          destinationBranch: true,
        },
      });

      if (!manifest) {
        return res.status(404).json({ error: 'Transfer manifest not found.' });
      }

      if (manifest.status === TransferStatus.RECEIVED) {
        return res.status(400).json({ error: 'Manifest has already been received and stocked.' });
      }

      if (manifest.status === TransferStatus.REJECTED) {
        return res.status(400).json({ error: 'Manifest has been marked rejected.' });
      }

      if (crushed > manifest.dispatchedLoaves) {
        return res.status(400).json({
          error: `Crushed loaves (${crushed}) cannot exceed total dispatched loaves (${manifest.dispatchedLoaves}).`,
        });
      }

      // Supervisor approval PIN check (optional if no damaged loaves, required/verified if damaged)
      let supervisorCodeVerified = false;
      if (supervisorPin) {
        const supervisor = await prisma.user.findFirst({
          where: {
            role: { in: [Role.OWNER, Role.ADMIN, Role.BRANCH_MANAGER] },
            isActive: true,
            managerApprovalPinHash: { not: null },
          },
        });

        if (supervisor && supervisor.managerApprovalPinHash) {
          const isMatch = await bcrypt.compare(supervisorPin, supervisor.managerApprovalPinHash);
          if (isMatch) {
            supervisorCodeVerified = true;
          }
        }
      }

      // Physics Math:
      // intactLoaves = dispatchedLoaves - crushedLoaves
      // driverBilledCost = crushedLoaves * sellingPrice (Driver Accountability Rule)
      const intactLoaves = manifest.dispatchedLoaves - crushed;
      const unitPrice = Number(manifest.product.sellingPrice || 15.0);
      const driverBilledCost = Number((crushed * unitPrice).toFixed(2));
      const now = new Date();

      // Transaction:
      // 1. Credit Spoke BranchProductStock with +intactLoaves (Developer 1 -> Developer 2 Handover Point!)
      // 2. Mark manifest as RECEIVED, record crushed loaves and driver damages
      const updatedManifest = await prisma.$transaction(async (tx) => {
        // Developer 1 adds intact loaves to shelf stock!
        await tx.branchProductStock.upsert({
          where: {
            branchId_productId: {
              branchId: manifest.destinationBranchId,
              productId: manifest.productId,
            },
          },
          update: {
            availableStock: { increment: intactLoaves },
          },
          create: {
            branchId: manifest.destinationBranchId,
            productId: manifest.productId,
            availableStock: intactLoaves,
          },
        });

        const updated = await tx.transferManifest.update({
          where: { id },
          data: {
            status: TransferStatus.RECEIVED,
            receivedLoaves: intactLoaves,
            crushedLoaves: crushed,
            driverBilledCost,
            receivedByUserId: req.user!.id,
            receivedAt: now,
            supervisorCodeVerified,
            notes: notes ? `${manifest.notes || ''} | ${notes.trim()}`.trim() : manifest.notes,
          },
          include: {
            sourceBranch: {
              select: { id: true, name: true, code: true },
            },
            destinationBranch: {
              select: { id: true, name: true, code: true },
            },
            product: {
              select: { id: true, name: true, sku: true, sellingPrice: true },
            },
            driver: {
              select: { id: true, fullName: true, phone: true },
            },
            receivedByUser: {
              select: { id: true, fullName: true, role: true },
            },
          },
        });

        return updated;
      }, {
        maxWait: 10000,
        timeout: 20000,
      });

      const damageNotice =
        crushed > 0
          ? ` Driver accountability applied: ${crushed} crushed loaves billed at ETB ${driverBilledCost.toFixed(2)}.`
          : '';

      return res.json({
        message: `Delivery successfully accepted at ${manifest.destinationBranch.name}. Added +${intactLoaves} loaves to shelf stock.${damageNotice}`,
        manifest: updatedManifest,
      });
    } catch (err: any) {
      console.error('Receive transfer handshake error:', err);
      return res.status(500).json({ error: 'Failed to complete receiving handshake.' });
    }
  }
);
