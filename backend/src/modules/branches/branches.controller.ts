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
      name,
      code: code.toUpperCase(),
      isHub: Boolean(isHub),
      address,
    },
  });

  return res.status(201).json({ branch });
});
