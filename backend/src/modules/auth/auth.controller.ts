import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { authMiddleware, signToken, type AuthRequest } from '../../middleware/auth.js';

export const authRouter = Router();

// Standard Phone + Password Login
authRouter.post('/login', async (req: Request, res: Response) => {
  const { phone, password } = req.body;
  const phoneTrim = phone?.trim();

  if (!phoneTrim || !password) {
    return res.status(400).json({ error: 'Phone number and password are required.' });
  }

  const user = await prisma.user.findUnique({
    where: { phone: phoneTrim },
    include: {
      branch: {
        select: {
          id: true,
          name: true,
          code: true,
          isHub: true,
          address: true,
          isActive: true,
        },
      },
    },
  });

  if (!user) {
    return res.status(401).json({ error: 'Invalid phone number or password.' });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: 'Your account has been deactivated. Contact an administrator.' });
  }

  if (user.role !== 'OWNER' && user.role !== 'ADMIN' && user.branch && !user.branch.isActive) {
    return res.status(403).json({ error: 'Login denied: Your assigned branch is currently inactive.' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Invalid phone number or password.' });
  }

  const token = signToken({
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    branchId: user.branchId,
  });

  return res.json({
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      branchId: user.branchId,
      branch: user.branch,
      salary: user.salary,
      shift: user.shift,
    },
  });
});

// Current User Profile & Assigned Branch
authRouter.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      fullName: true,
      phone: true,
      role: true,
      branchId: true,
      salary: true,
      shift: true,
      isActive: true,
      branch: {
        select: {
          id: true,
          name: true,
          code: true,
          isHub: true,
          address: true,
          isActive: true,
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  return res.json({ user });
});

// Change Password
authRouter.patch('/password', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  if (newPassword.trim().length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'Incorrect current password.' });
  }

  const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return res.json({ message: 'Password updated successfully.' });
});

// Logout
authRouter.post('/logout', authMiddleware, (_req: AuthRequest, res: Response) => {
  return res.json({ message: 'Logged out successfully.' });
});
