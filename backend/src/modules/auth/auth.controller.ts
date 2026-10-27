import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { authMiddleware, signToken, requireRoles, type AuthRequest } from '../../middleware/auth.js';
import { Role } from '@prisma/client';

export const authRouter = Router();

export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '').replace(/[-()]/g, '');
  if (cleaned.startsWith('+251')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('251')) {
    cleaned = '0' + cleaned.slice(3);
  } else if ((cleaned.startsWith('9') || cleaned.startsWith('7')) && cleaned.length === 9) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

function formatUserDto(user: any) {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    branchId: user.branchId,
    branch: user.branch
      ? {
          id: user.branch.id,
          name: user.branch.name,
          code: user.branch.code,
          isHub: user.branch.isHub,
          address: user.branch.address,
          isActive: user.branch.isActive,
        }
      : null,
    avatarUrl: user.avatarUrl || null,
    filesUrl: user.filesUrl || null,
    salary: user.salary ? Number(user.salary) : null,
    shift: user.shift || null,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// Standard Phone + Password Login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;
    const phoneTrim = phone?.trim();

    if (!phoneTrim || !password) {
      return res.status(400).json({ error: 'Phone number and password are required.' });
    }

    const clean = normalizePhone(phoneTrim);

    // Search by exact phone or normalized phone
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ phone: phoneTrim }, { phone: clean }],
      },
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

    if (user.role !== Role.OWNER && user.role !== Role.ADMIN && user.branch && !user.branch.isActive) {
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

    const userDto = formatUserDto(user);

    return res.json({
      token,
      user: userDto,
      ...userDto,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed due to a server error. Please try again.' });
  }
});

// Current User Profile & Assigned Branch
authRouter.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
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
      return res.status(404).json({ error: 'User not found.' });
    }

    const userDto = formatUserDto(user);

    return res.json({
      ...userDto,
      user: userDto,
    });
  } catch (err: any) {
    console.error('Auth /me error:', err);
    return res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});

// Public employee request for password reset
authRouter.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    const phoneTrim = phone?.trim();
    if (!phoneTrim) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const clean = normalizePhone(phoneTrim);

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ phone: phoneTrim }, { phone: clean }],
        isActive: true,
      },
    });

    if (!user) {
      // Avoid enumeration; return generic confirmation
      return res.json({
        message: 'Password reset request submitted. If your account exists and is active, your Manager or Administrator can assist you with a new password.',
      });
    }

    const existingPending = await prisma.passwordResetRequest.findFirst({
      where: {
        userId: user.id,
        status: 'PENDING',
      },
    });

    if (!existingPending) {
      await prisma.passwordResetRequest.create({
        data: {
          userId: user.id,
          phone: user.phone,
          status: 'PENDING',
        },
      });
    }

    return res.json({
      message: 'Password reset request submitted successfully. Please inform your branch manager or administrator.',
    });
  } catch (err: any) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Failed to submit reset request.' });
  }
});

// Protected: List password reset requests (OWNER & ADMIN)
authRouter.get(
  '/password-reset-requests',
  authMiddleware,
  requireRoles(Role.OWNER, Role.ADMIN),
  async (_req: AuthRequest, res: Response) => {
    try {
      const requests = await prisma.passwordResetRequest.findMany({
        orderBy: { requestedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              role: true,
              branch: { select: { id: true, name: true } },
            },
          },
        },
      });
      return res.json({ requests });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to retrieve reset requests.' });
    }
  }
);

// Protected: Admin reset employee password
authRouter.post(
  '/admin-reset-password',
  authMiddleware,
  requireRoles(Role.OWNER, Role.ADMIN),
  async (req: AuthRequest, res: Response) => {
    try {
      const { requestId, userId, newPassword } = req.body;
      const targetUserId = userId || (requestId ? (await prisma.passwordResetRequest.findUnique({ where: { id: requestId } }))?.userId : null);

      if (!targetUserId || !newPassword) {
        return res.status(400).json({ error: 'User ID and new password are required.' });
      }

      if (newPassword.trim().length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters.' });
      }

      const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
      await prisma.user.update({
        where: { id: targetUserId },
        data: { passwordHash },
      });

      if (requestId) {
        await prisma.passwordResetRequest.update({
          where: { id: requestId },
          data: {
            status: 'RESOLVED',
            resolvedAt: new Date(),
            resolvedByUserId: req.user!.id,
          },
        });
      }

      return res.json({ message: 'Employee password successfully reset.' });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to reset employee password.' });
    }
  }
);

// Change Password
authRouter.patch('/password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
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
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update password.' });
  }
});

// Logout
authRouter.post('/logout', authMiddleware, (_req: AuthRequest, res: Response) => {
  return res.json({ message: 'Logged out successfully.' });
});
