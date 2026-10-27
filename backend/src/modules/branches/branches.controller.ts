import { Router, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { authMiddleware, requireRoles, type AuthRequest } from '../../middleware/auth.js';
import { Role } from '@prisma/client';

export const branchesRouter = Router();

// List branches (OWNER/ADMIN see all; staff only see their own assigned branch)
branchesRouter.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const isGlobal = req.user!.role === Role.OWNER || req.user!.role === Role.ADMIN;

  const whereCondition: any = { isActive: true };
  if (!isGlobal) {
    if (!req.user!.branchId) {
      return res.json({ branches: [] });
    }
    whereCondition.id = req.user!.branchId;
  }

  const branches = await prisma.branch.findMany({
    where: whereCondition,
    include: {
      _count: {
        select: {
          users: true,
          productStocks: true,
        },
      },
    },
    orderBy: [{ isHub: 'desc' }, { name: 'asc' }],
  });

  return res.json({ branches });
});

// Get Single Branch Details (Staff can only view their own branch)
branchesRouter.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const isGlobal = req.user!.role === Role.OWNER || req.user!.role === Role.ADMIN;
  if (!isGlobal && req.user!.branchId !== req.params.id) {
    return res.status(403).json({ error: 'Access denied: You can only view your assigned branch.' });
  }

  const branch = await prisma.branch.findUnique({
    where: { id: req.params.id },
    include: {
      company: true,
      users: {
        where: { isActive: true },
        select: { id: true, fullName: true, role: true, phone: true },
      },
    },
  });

  if (!branch) {
    return res.status(404).json({ error: 'Branch not found.' });
  }

  return res.json({ branch });
});

// Create Branch (OWNER / ADMIN only)
branchesRouter.post('/', authMiddleware, requireRoles(Role.OWNER, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const { name, code, isHub, address, companyId } = req.body;

  if (!name || !code) {
    return res.status(400).json({ error: 'Branch name and code are required.' });
  }

  let finalCompanyId = companyId;
  if (!finalCompanyId) {
    const comp = await prisma.company.findFirst();
    if (!comp) return res.status(400).json({ error: 'No company exists. Run seed script first.' });
    finalCompanyId = comp.id;
  }

  const existing = await prisma.branch.findUnique({ where: { code: code.toUpperCase() } });
  if (existing) {
    return res.status(409).json({ error: `Branch code '${code}' is already in use.` });
  }

  const branch = await prisma.branch.create({
    data: {
      companyId: finalCompanyId,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      isHub: Boolean(isHub),
      address: address ? address.trim() : null,
    },
    include: {
      _count: {
        select: {
          users: true,
          productStocks: true,
        },
      },
    },
  });

  return res.status(201).json({ branch });
});

// Update Branch (OWNER / ADMIN only)
branchesRouter.patch('/:id', authMiddleware, requireRoles(Role.OWNER, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, code, isHub, address, isActive } = req.body;

  const existing = await prisma.branch.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: 'Branch not found.' });
  }

  // If changing code, ensure uniqueness
  if (code && code.trim().toUpperCase() !== existing.code) {
    const codeConflict = await prisma.branch.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (codeConflict) {
      return res.status(409).json({ error: `Branch code '${code}' is already assigned to another branch.` });
    }
  }

  const updated = await prisma.branch.update({
    where: { id },
    data: {
      name: name !== undefined ? name.trim() : undefined,
      code: code !== undefined ? code.trim().toUpperCase() : undefined,
      isHub: isHub !== undefined ? Boolean(isHub) : undefined,
      address: address !== undefined ? (address ? address.trim() : null) : undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
    },
    include: {
      _count: {
        select: {
          users: true,
          productStocks: true,
        },
      },
    },
  });

  return res.json({ branch: updated });
});

// Delete / Deactivate Branch (OWNER only)
branchesRouter.delete('/:id', authMiddleware, requireRoles(Role.OWNER), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const branch = await prisma.branch.findUnique({
    where: { id },
    include: {
      _count: {
        select: { users: { where: { isActive: true } } },
      },
    },
  });

  if (!branch) {
    return res.status(404).json({ error: 'Branch not found.' });
  }

  // Soft deactivate instead of hard cascade to maintain audit integrity
  await prisma.branch.update({
    where: { id },
    data: { isActive: false },
  });

  return res.json({ message: `Branch '${branch.name}' has been deactivated.` });
});
