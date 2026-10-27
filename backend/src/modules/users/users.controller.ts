import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { authMiddleware, requireRoles, type AuthRequest } from '../../middleware/auth.js';
import { Role } from '@prisma/client';

export const usersRouter = Router();

// List Users (OWNER/ADMIN see all; managers/staff only see their assigned branch)
usersRouter.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const isGlobal = req.user!.role === Role.OWNER || req.user!.role === Role.ADMIN;
  let targetBranchId: string | undefined = undefined;

  if (isGlobal) {
    targetBranchId = (req.query.branchId as string) || undefined;
  } else {
    targetBranchId = req.user!.branchId || undefined;
  }

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      branchId: targetBranchId,
      role: req.query.role ? (req.query.role as Role) : undefined,
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      role: true,
      branchId: true,
      salary: true,
      shift: true,
      isActive: true,
      createdAt: true,
      branch: {
        select: { id: true, name: true, code: true, isHub: true },
      },
    },
    orderBy: { fullName: 'asc' },
  });

  return res.json({ users });
});

// Create Staff User (OWNER / ADMIN / BRANCH_MANAGER)
usersRouter.post('/', authMiddleware, requireRoles(Role.OWNER, Role.ADMIN, Role.BRANCH_MANAGER), async (req: AuthRequest, res: Response) => {
  const { fullName, phone, password, role, branchId, salary, shift } = req.body;

  if (!fullName || !phone || !role) {
    return res.status(400).json({ error: 'Full name, phone number, and role are required.' });
  }

  if (!password || password.trim().length < 6) {
    return res.status(400).json({ error: 'A password with a minimum of 6 characters is required.' });
  }

  let finalBranchId = branchId;
  // Branch managers can only create staff in their own branch
  if (req.user!.role === Role.BRANCH_MANAGER) {
    finalBranchId = req.user!.branchId;
  }

  const existing = await prisma.user.findUnique({ where: { phone: phone.trim() } });
  if (existing) {
    return res.status(409).json({ error: 'A staff member with this phone number already exists.' });
  }

  const passwordHash = await bcrypt.hash(password.trim(), 10);

  const user = await prisma.user.create({
    data: {
      fullName: fullName.trim(),
      phone: phone.trim(),
      passwordHash,
      role: role as Role,
      branchId: finalBranchId || null,
      salary: salary ? Number(salary) : null,
      shift: shift || null,
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      role: true,
      branchId: true,
      salary: true,
      shift: true,
      createdAt: true,
      branch: true,
    },
  });

  return res.status(201).json({ user });
});

// Admin / Manager reset employee password
usersRouter.patch('/:id/password', authMiddleware, requireRoles(Role.OWNER, Role.ADMIN, Role.BRANCH_MANAGER), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.trim().length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found.' });
  }

  // Branch managers can only reset passwords for employees in their own branch
  if (req.user!.role === Role.BRANCH_MANAGER && targetUser.branchId !== req.user!.branchId) {
    return res.status(403).json({ error: 'Permission denied: Cannot reset password for another branch employee.' });
  }

  const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });

  return res.json({ message: `Password for ${targetUser.fullName} updated successfully.` });
});
