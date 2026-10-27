import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { prisma } from '../../config/prisma.js';
import { authMiddleware, requireRoles, type AuthRequest } from '../../middleware/auth.js';
import { Role, Shift } from '@prisma/client';
import { uploadToStorage } from '../../lib/storage.js';

export const usersRouter = Router();

// Multer in-memory storage for handling identification document (PDF) and avatar (Image)
const memoryStorage = multer.memoryStorage();

const userUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req: any, file, cb) => {
    const isAvatar = file.fieldname === 'avatar';
    if (isAvatar) {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      const isImgExt = file.originalname.match(/\.(jpe?g|png|webp)$/i);
      if (allowed.includes(file.mimetype.toLowerCase()) || isImgExt) {
        cb(null, true);
      } else {
        cb(new Error('Unsupported avatar format. Please upload a JPG, PNG, or WebP image.'));
      }
    } else {
      // User identification file: Allow PDF or Images (Kebele ID, passport, contract, license)
      const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      const isAllowedExt = file.originalname.match(/\.(pdf|jpe?g|png|webp)$/i);
      if (allowedMimes.includes(file.mimetype.toLowerCase()) || isAllowedExt) {
        cb(null, true);
      } else {
        cb(new Error('Invalid document format. Identification file must be a PDF document or an image (JPG, PNG, WebP).'));
      }
    }
  },
});

function handleUserFormUpload(req: any, res: any, next: any) {
  userUpload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'avatar', maxCount: 1 },
  ])(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload error' });
    }
    next();
  });
}

// 1. Roles Metadata Endpoint (For role setting & UI badges)
usersRouter.get('/roles', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const roles = [
    {
      role: Role.OWNER,
      label: 'Owner',
      category: 'Executive',
      description: 'Global access across all branches, financial P&L, system configuration.',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    },
    {
      role: Role.ADMIN,
      label: 'Administrator',
      category: 'Management',
      description: 'Enterprise operations, branch management, employee onboarding.',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    },
    {
      role: Role.BRANCH_MANAGER,
      label: 'Branch Manager',
      category: 'Management',
      description: 'Oversees local branch staff, cash closing, daily operational performance.',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    },
    {
      role: Role.CASHIER,
      label: 'Retail Cashier',
      category: 'Front-of-House',
      description: 'POS counter touchscreen sales, multi-tender collection, daily leftovers.',
      badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
    },
    {
      role: Role.STOREKEEPER,
      label: 'Storekeeper',
      category: 'Warehouse',
      description: 'Flour and raw material inventory, supplier delivery intake, stock safety.',
      badgeColor: 'bg-orange-100 text-orange-800 border-orange-300',
    },
    {
      role: Role.PRODUCTION_SUPERVISOR,
      label: 'Production Supervisor',
      category: 'Baking Operations',
      description: 'Dough batch oversight, recipe yield monitoring, shift handoffs.',
      badgeColor: 'bg-red-100 text-red-800 border-red-300',
    },
    {
      role: Role.BAKER,
      label: 'Master Baker',
      category: 'Baking Operations',
      description: 'Oven execution, batch output logging, pastry preparation.',
      badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    },
    {
      role: Role.DRIVER,
      label: 'Logistics Driver',
      category: 'Logistics',
      description: 'Inter-branch bread transfers from Central Hub to retail spokes.',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    },
  ];

  return res.json({ roles });
});

// 2. List Users (with Search, Branch Filter, Role Filter)
usersRouter.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const isGlobal = req.user!.role === Role.OWNER || req.user!.role === Role.ADMIN;
  let targetBranchId: string | undefined = undefined;

  if (isGlobal) {
    targetBranchId = (req.query.branchId as string) || undefined;
  } else {
    targetBranchId = req.user!.branchId || undefined;
  }

  const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
  const roleFilter = typeof req.query.role === 'string' ? (req.query.role as Role) : undefined;
  const activeOnly = req.query.includeInactive !== 'true';

  const whereCondition: any = {};

  if (activeOnly) {
    whereCondition.isActive = true;
  }

  if (targetBranchId) {
    whereCondition.branchId = targetBranchId;
  }

  if (roleFilter && Object.values(Role).includes(roleFilter)) {
    whereCondition.role = roleFilter;
  }

  if (search) {
    whereCondition.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

  const users = await prisma.user.findMany({
    where: whereCondition,
    select: {
      id: true,
      fullName: true,
      phone: true,
      role: true,
      branchId: true,
      salary: true,
      shift: true,
      avatarUrl: true,
      filesUrl: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      branch: {
        select: { id: true, name: true, code: true, isHub: true },
      },
    },
    orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
  });

  return res.json({ users });
});

// 3. Get Single User Details
usersRouter.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const isGlobal = req.user!.role === Role.OWNER || req.user!.role === Role.ADMIN;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      phone: true,
      role: true,
      branchId: true,
      salary: true,
      shift: true,
      avatarUrl: true,
      filesUrl: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      branch: {
        select: { id: true, name: true, code: true, isHub: true, address: true },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  if (!isGlobal && req.user!.branchId !== user.branchId && req.user!.id !== user.id) {
    return res.status(403).json({ error: 'Access denied: You can only view staff within your branch.' });
  }

  return res.json({ user });
});

// 4. Create Staff User (OWNER / ADMIN / BRANCH_MANAGER) with PDF Document & Avatar support
usersRouter.post(
  '/',
  authMiddleware,
  requireRoles(Role.OWNER, Role.ADMIN, Role.BRANCH_MANAGER),
  handleUserFormUpload,
  async (req: AuthRequest, res: Response) => {
    const { fullName, phone, password, role, branchId, salary, shift } = req.body;

    if (!fullName || !phone || !role) {
      return res.status(400).json({ error: 'Full name, phone number, and role are required.' });
    }

    if (!password || password.trim().length < 6) {
      return res.status(400).json({ error: 'A password with a minimum of 6 characters is required.' });
    }

    if (!Object.values(Role).includes(role as Role)) {
      return res.status(400).json({ error: `Invalid role '${role}'.` });
    }

    let finalBranchId = branchId;
    if (req.user!.role === Role.BRANCH_MANAGER) {
      finalBranchId = req.user!.branchId;
    }

    if (role === Role.OWNER && req.user!.role !== Role.OWNER) {
      return res.status(403).json({ error: 'Only an existing Owner can create another Owner account.' });
    }

    const existing = await prisma.user.findUnique({ where: { phone: phone.trim() } });
    if (existing) {
      return res.status(409).json({ error: 'A staff member with this phone number already exists.' });
    }

    // Process uploaded document and avatar
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const docFile = files?.file?.[0];
    const avatarFile = files?.avatar?.[0];

    let filesUrl: string | null = req.body.filesUrl || null;
    let avatarUrl: string | null = req.body.avatarUrl || null;

    try {
      if (docFile) {
        filesUrl = await uploadToStorage(docFile, 'documents');
      }
      if (avatarFile) {
        avatarUrl = await uploadToStorage(avatarFile, 'avatars');
      }
    } catch (uploadErr: any) {
      return res.status(500).json({ error: uploadErr.message || 'File upload failed.' });
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
        shift: shift ? (shift as Shift) : null,
        avatarUrl,
        filesUrl,
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true,
        branchId: true,
        salary: true,
        shift: true,
        avatarUrl: true,
        filesUrl: true,
        isActive: true,
        createdAt: true,
        branch: { select: { id: true, name: true, code: true, isHub: true } },
      },
    });

    return res.status(201).json({ user });
  }
);

// 5. Update Staff Member (with PDF/Avatar update support)
usersRouter.patch(
  '/:id',
  authMiddleware,
  requireRoles(Role.OWNER, Role.ADMIN, Role.BRANCH_MANAGER),
  handleUserFormUpload,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { fullName, phone, role, branchId, salary, shift, isActive } = req.body;

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (req.user!.role === Role.BRANCH_MANAGER) {
      if (targetUser.branchId !== req.user!.branchId) {
        return res.status(403).json({ error: 'Permission denied: Cannot edit staff in another branch.' });
      }
      if (targetUser.role === Role.OWNER || targetUser.role === Role.ADMIN || targetUser.role === Role.BRANCH_MANAGER) {
        return res.status(403).json({ error: 'Permission denied: Cannot modify management accounts.' });
      }
    }

    if (phone && phone.trim() !== targetUser.phone) {
      const phoneExists = await prisma.user.findUnique({ where: { phone: phone.trim() } });
      if (phoneExists) {
        return res.status(409).json({ error: 'Phone number is already registered to another staff member.' });
      }
    }

    // Process new uploaded files if provided
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const docFile = files?.file?.[0];
    const avatarFile = files?.avatar?.[0];

    let filesUrl: string | undefined = undefined;
    let avatarUrl: string | undefined = undefined;

    try {
      if (docFile) {
        filesUrl = await uploadToStorage(docFile, 'documents');
      }
      if (avatarFile) {
        avatarUrl = await uploadToStorage(avatarFile, 'avatars');
      }
    } catch (uploadErr: any) {
      return res.status(500).json({ error: uploadErr.message || 'File upload failed.' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        fullName: fullName !== undefined ? fullName.trim() : undefined,
        phone: phone !== undefined ? phone.trim() : undefined,
        role: role !== undefined ? (role as Role) : undefined,
        branchId: branchId !== undefined ? (branchId || null) : undefined,
        salary: salary !== undefined ? (salary ? Number(salary) : null) : undefined,
        shift: shift !== undefined ? (shift ? (shift as Shift) : null) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        filesUrl: filesUrl !== undefined ? filesUrl : undefined,
        avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true,
        branchId: true,
        salary: true,
        shift: true,
        avatarUrl: true,
        filesUrl: true,
        isActive: true,
        updatedAt: true,
        branch: { select: { id: true, name: true, code: true, isHub: true } },
      },
    });

    return res.json({ user: updated });
  }
);

// 6. Admin / Manager Reset Staff Password
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

// 7. Deactivate Staff Member
usersRouter.delete('/:id', authMiddleware, requireRoles(Role.OWNER, Role.ADMIN), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  if (req.user!.id === id) {
    return res.status(400).json({ error: 'You cannot deactivate your own account.' });
  }

  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found.' });
  }

  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });

  return res.json({ message: `User ${targetUser.fullName} deactivated successfully.` });
});
