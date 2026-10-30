import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  userId?: string;
  fullName: string;
  phone: string;
  role: Role;
  branchId: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  tenantId?: string;
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is missing.');
    }
    return 'habesha-bakery-jwt-secret-key-2026-production-change';
  }
  return secret;
}

export function signToken(user: {
  id: string;
  fullName?: string;
  phone?: string;
  role: Role;
  branchId?: string | null;
}): string {
  return jwt.sign(
    {
      id: user.id,
      userId: user.id, // For backward compatibility with old ERP
      fullName: user.fullName || '',
      phone: user.phone || '',
      role: user.role,
      branchId: user.branchId || null,
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing or malformed token.' });
  }

  const token = authHeader.split(' ')[1];
  let decoded: any;
  try {
    decoded = jwt.verify(token, getJwtSecret()) as any;
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }

  const targetUserId = decoded.id || decoded.userId;
  if (!targetUserId) {
    return res.status(401).json({ error: 'Invalid token payload.' });
  }

  try {
    // Verify user is still active in database and assigned branch is active
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true,
        branchId: true,
        isActive: true,
        branch: { select: { isActive: true } },
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User account is deactivated or no longer exists.' });
    }

    if (user.role !== Role.OWNER && user.role !== Role.ADMIN && user.branch && !user.branch.isActive) {
      return res.status(403).json({ error: 'Login denied: Your assigned branch is currently inactive.' });
    }

    req.user = {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      branchId: user.branchId,
    };
    next();
  } catch (dbErr: any) {
    console.error('Database connection error in authMiddleware:', dbErr?.message || dbErr);
    return res.status(503).json({ error: 'Authentication service temporarily unavailable due to database connectivity issue.' });
  }
}

export function requireRoles(...allowedRoles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    // OWNER and ADMIN have global operational access
    if (req.user.role === Role.OWNER || req.user.role === Role.ADMIN) {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Permission denied. Required roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}

export const requireRole = requireRoles;
