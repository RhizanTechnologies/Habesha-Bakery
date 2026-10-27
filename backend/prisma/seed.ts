import { PrismaClient, Role, Shift } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Habesha Bakery Foundation Dataset (Standard Auth)...');

  // 1. Company
  const company = await prisma.company.upsert({
    where: { name: 'Habesha Bakery Enterprise' },
    update: {},
    create: {
      name: 'Habesha Bakery Enterprise',
      email: 'contact@habeshabakery.et',
      phone: '0911223344',
      address: 'Bole, Addis Ababa, Ethiopia',
    },
  });
  console.log(`✅ Company seeded: ${company.name}`);

  // 2. 5 Branches
  const branchesData = [
    { name: 'Bole Central Hub', code: 'BOLE-HUB', isHub: true, address: 'Bole Medhanialem, Production & Warehouse Hub' },
    { name: 'Megenagna Spoke', code: 'MEG', isHub: false, address: 'Zefmesh Mall Area, Megenagna' },
    { name: 'Piassa Spoke', code: 'PIA', isHub: false, address: 'Churchill Road, Piassa' },
    { name: 'Saris Spoke', code: 'SAR', isHub: false, address: 'Saris Kadisco Area' },
    { name: 'CMC Spoke', code: 'CMC', isHub: false, address: 'CMC Michael Commercial Center' },
  ];

  const branchMap = new Map<string, string>();
  for (const b of branchesData) {
    const branch = await prisma.branch.upsert({
      where: { code: b.code },
      update: { isHub: b.isHub, address: b.address },
      create: {
        companyId: company.id,
        name: b.name,
        code: b.code,
        isHub: b.isHub,
        address: b.address,
      },
    });
    branchMap.set(b.code, branch.id);
  }
  console.log(`✅ 5 Branches seeded: 1 Central Hub + 4 Retail Spokes`);

  // 3. Password hash
  const defaultPasswordHash = await bcrypt.hash('password123', 10);

  // 4. Staff Users (Standard phone + password login)
  const staffData = [
    // Global Owner (HQ / All Branches)
    {
      fullName: 'Mame Owner',
      phone: '0911000000',
      role: Role.OWNER,
      branchCode: null,
      salary: 50000,
      shift: null,
    },
    {
      fullName: 'Habesha Executive Owner',
      phone: '0912345678',
      role: Role.OWNER,
      branchCode: null,
      salary: 50000,
      shift: null,
    },
    // Bole Central Hub Staff
    {
      fullName: 'Solomon Storekeeper',
      phone: '0911000001',
      role: Role.STOREKEEPER,
      branchCode: 'BOLE-HUB',
      salary: 16000,
      shift: Shift.DAY,
    },
    {
      fullName: 'Abebe Production Supervisor',
      phone: '0911000002',
      role: Role.PRODUCTION_SUPERVISOR,
      branchCode: 'BOLE-HUB',
      salary: 24000,
      shift: Shift.DAY,
    },
    {
      fullName: 'Tadesse Master Baker',
      phone: '0911000003',
      role: Role.BAKER,
      branchCode: 'BOLE-HUB',
      salary: 19000,
      shift: Shift.DAY,
    },
    {
      fullName: 'Bekele Van Driver',
      phone: '0911000004',
      role: Role.DRIVER,
      branchCode: 'BOLE-HUB',
      salary: 14000,
      shift: Shift.DAY,
    },
    // Retail Spokes Staff (Tied strictly to their own branch)
    {
      fullName: 'Selam Megenagna Cashier',
      phone: '0911000011',
      role: Role.CASHIER,
      branchCode: 'MEG',
      salary: 13500,
      shift: Shift.DAY,
    },
    {
      fullName: 'Dawit Megenagna Manager',
      phone: '0911000012',
      role: Role.BRANCH_MANAGER,
      branchCode: 'MEG',
      salary: 22000,
      shift: null,
    },
    {
      fullName: 'Almaz Piassa Cashier',
      phone: '0911000021',
      role: Role.CASHIER,
      branchCode: 'PIA',
      salary: 13500,
      shift: Shift.DAY,
    },
    {
      fullName: 'Yonas Piassa Manager',
      phone: '0911000022',
      role: Role.BRANCH_MANAGER,
      branchCode: 'PIA',
      salary: 22000,
      shift: null,
    },
    {
      fullName: 'Hanna Saris Cashier',
      phone: '0911000031',
      role: Role.CASHIER,
      branchCode: 'SAR',
      salary: 13500,
      shift: Shift.DAY,
    },
    {
      fullName: 'Eden CMC Cashier',
      phone: '0911000041',
      role: Role.CASHIER,
      branchCode: 'CMC',
      salary: 13500,
      shift: Shift.DAY,
    },
  ];

  for (const s of staffData) {
    const branchId = s.branchCode ? branchMap.get(s.branchCode) || null : null;
    await prisma.user.upsert({
      where: { phone: s.phone },
      update: {
        fullName: s.fullName,
        role: s.role,
        branchId,
        salary: s.salary,
        shift: s.shift,
      },
      create: {
        fullName: s.fullName,
        phone: s.phone,
        passwordHash: defaultPasswordHash,
        role: s.role,
        branchId,
        salary: s.salary,
        shift: s.shift,
      },
    });
  }
  console.log(`✅ 11 Staff Users seeded with standard phone/password auth`);

  // 5. Product Categories & Bread Catalog
  const category = await prisma.productCategory.upsert({
    where: { name: 'Fresh Bread' },
    update: {},
    create: {
      name: 'Fresh Bread',
      description: 'Standard daily baked bread items',
    },
  });

  const productsData = [
    { name: 'Standard Loaf 50g', sku: 'BREAD-50G', sellingPrice: 15.0, costPrice: 9.5, unit: 'PIECE' },
    { name: 'French Baguette 250g', sku: 'BAGUETTE-250G', sellingPrice: 45.0, costPrice: 28.0, unit: 'PIECE' },
    { name: 'Burger Buns Pack of 4', sku: 'BUN-PACK4', sellingPrice: 50.0, costPrice: 32.0, unit: 'PACK' },
    { name: 'Day-Old Discount Loaf', sku: 'DAY_OLD_LOAF', sellingPrice: 8.0, costPrice: 7.0, unit: 'PIECE' },
  ];

  for (const p of productsData) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: { sellingPrice: p.sellingPrice, costPrice: p.costPrice },
      create: {
        categoryId: category.id,
        name: p.name,
        sku: p.sku,
        sellingPrice: p.sellingPrice,
        costPrice: p.costPrice,
        unit: p.unit,
      },
    });

    // Seed stock for each branch
    for (const [_, bId] of branchMap.entries()) {
      await prisma.branchProductStock.upsert({
        where: { branchId_productId: { branchId: bId, productId: product.id } },
        update: { availableStock: 100 },
        create: {
          branchId: bId,
          productId: product.id,
          availableStock: 100,
        },
      });
    }
  }
  console.log(`✅ Initial Bread Catalog & Starter Shelf Stock seeded across all 5 branches`);
  console.log('🎉 Foundation Seeding Complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
