import { Router, Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';

export const companyRouter = Router();

// Public / Authenticated company profile
companyRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const company = await prisma.company.findFirst({
      include: {
        _count: {
          select: {
            branches: true,
          },
        },
      },
    });

    const totalUsers = await prisma.user.count({ where: { isActive: true } });

    if (!company) {
      return res.status(404).json({ error: 'Company record not initialized.' });
    }

    return res.json({
      company: {
        id: company.id,
        name: company.name,
        email: company.email,
        phone: company.phone,
        address: company.address,
        totalBranches: company._count.branches,
        totalUsers,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to retrieve company profile.' });
  }
});
