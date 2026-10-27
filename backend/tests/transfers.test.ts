import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

describe('Developer 1: Crate Logistics & Driver Delivery Handshake (/transfers)', () => {
  let ownerToken: string;
  let driverToken: string;
  let cashierToken: string;
  let boleHub: any;
  let megenagnaSpoke: any;
  let breadProduct: any;
  let driverUser: any;

  before(async () => {
    // Warm up DB connection in case of serverless cold-start
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
      await prisma.$queryRaw`SELECT 1`;
    }

    // 1. Get tokens for Owner, Driver, and Cashier
    const ownerRes = await request(app).post('/api/auth/login').send({
      phone: '0911000000',
      password: 'password123',
    });
    ownerToken = ownerRes.body.token;

    const driverRes = await request(app).post('/api/auth/login').send({
      phone: '0911000004',
      password: 'password123',
    });
    driverToken = driverRes.body.token;

    const cashierRes = await request(app).post('/api/auth/login').send({
      phone: '0911000011',
      password: 'password123',
    });
    cashierToken = cashierRes.body.token;

    // 2. Fetch Branches, Product, and Driver
    boleHub = await prisma.branch.findFirst({ where: { code: 'BOLE-HUB' } });
    megenagnaSpoke = await prisma.branch.findFirst({ where: { code: 'MEG' } });
    breadProduct = await prisma.product.findFirst({ where: { sku: 'BREAD-50G' } });
    driverUser = await prisma.user.findFirst({ where: { phone: '0911000004' } });

    assert.ok(boleHub, 'Bole Hub must exist');
    assert.ok(megenagnaSpoke, 'Megenagna Spoke must exist');
    assert.ok(breadProduct, 'Bread Product must exist');
    assert.ok(driverUser, 'Driver must exist');
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it('accurately calculates 40-loaf crate packaging physics (5,448 loaves = 137 crates)', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sourceBranchId: boleHub.id,
        destinationBranchId: megenagnaSpoke.id,
        productId: breadProduct.id,
        dispatchedLoaves: 5448,
        driverId: driverUser.id,
        notes: 'Morning rush delivery to Megenagna',
      });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.manifest);
    assert.strictEqual(res.body.manifest.dispatchedLoaves, 5448);
    // Math.ceil(5448 / 40) = 137 crates
    assert.strictEqual(res.body.manifest.crateCount, 137);
    assert.strictEqual(res.body.manifest.status, 'PENDING_DISPATCH');
    assert.match(res.body.manifest.manifestNumber, /^TRF-\d{8}-\d{4}$/);
  });

  it('accurately calculates exact multiple crate packaging (80 loaves = 2 crates)', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sourceBranchId: boleHub.id,
        destinationBranchId: megenagnaSpoke.id,
        productId: breadProduct.id,
        dispatchedLoaves: 80,
        driverId: driverUser.id,
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.manifest.crateCount, 2);
  });

  it('rejects transfer if source and destination branches are identical', async () => {
    const res = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sourceBranchId: boleHub.id,
        destinationBranchId: boleHub.id,
        productId: breadProduct.id,
        dispatchedLoaves: 100,
        driverId: driverUser.id,
      });

    assert.strictEqual(res.status, 400);
    assert.match(res.body.error, /cannot be the same/i);
  });

  it('driver performs departure handshake signing onto the manifest', async () => {
    // Create fresh manifest
    const createRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sourceBranchId: boleHub.id,
        destinationBranchId: megenagnaSpoke.id,
        productId: breadProduct.id,
        dispatchedLoaves: 100,
        driverId: driverUser.id,
      });

    const manifestId = createRes.body.manifest.id;

    const res = await request(app)
      .post(`/api/transfers/${manifestId}/dispatch`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.manifest.status, 'IN_TRANSIT');
    assert.ok(res.body.manifest.driverSignedAt);
    assert.ok(res.body.manifest.dispatchedAt);
  });

  it('spoke branch receives delivery intact (0 crushed) and automatically increments shelf stock by +100', async () => {
    // Check initial stock
    const initStock = await prisma.branchProductStock.findUnique({
      where: {
        branchId_productId: {
          branchId: megenagnaSpoke.id,
          productId: breadProduct.id,
        },
      },
    });
    const initialMegenagnaStock = initStock?.availableStock || 0;

    // Step 1: Create
    const createRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sourceBranchId: boleHub.id,
        destinationBranchId: megenagnaSpoke.id,
        productId: breadProduct.id,
        dispatchedLoaves: 100,
        driverId: driverUser.id,
      });
    const manifestId = createRes.body.manifest.id;

    // Step 2: Driver dispatches
    await request(app)
      .post(`/api/transfers/${manifestId}/dispatch`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send();

    // Step 3: Spoke staff receives delivery
    const receiveRes = await request(app)
      .post(`/api/transfers/${manifestId}/receive`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        crushedLoaves: 0,
        notes: 'All 100 loaves arrived in perfect warm condition.',
      });

    assert.strictEqual(receiveRes.status, 200);
    assert.strictEqual(receiveRes.body.manifest.status, 'RECEIVED');
    assert.strictEqual(receiveRes.body.manifest.receivedLoaves, 100);
    assert.strictEqual(receiveRes.body.manifest.crushedLoaves, 0);
    assert.strictEqual(Number(receiveRes.body.manifest.driverBilledCost), 0);

    // Verify Shelf Stock incremented by exactly +100
    const updatedStock = await prisma.branchProductStock.findUnique({
      where: {
        branchId_productId: {
          branchId: megenagnaSpoke.id,
          productId: breadProduct.id,
        },
      },
    });

    assert.strictEqual(updatedStock?.availableStock, initialMegenagnaStock + 100);
  });

  it('spoke branch receives delivery with 3 crushed loaves: bills driver 45 ETB and credits +97 loaves to shelf stock', async () => {
    // Check initial stock
    const initStock = await prisma.branchProductStock.findUnique({
      where: {
        branchId_productId: {
          branchId: megenagnaSpoke.id,
          productId: breadProduct.id,
        },
      },
    });
    const initialMegenagnaStock = initStock?.availableStock || 0;

    // Step 1: Create
    const createRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sourceBranchId: boleHub.id,
        destinationBranchId: megenagnaSpoke.id,
        productId: breadProduct.id,
        dispatchedLoaves: 100,
        driverId: driverUser.id,
      });
    const manifestId = createRes.body.manifest.id;

    // Step 2: Driver dispatches
    await request(app)
      .post(`/api/transfers/${manifestId}/dispatch`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send();

    // Step 3: Spoke staff receives delivery with 3 crushed loaves (15 ETB each = 45 ETB)
    const receiveRes = await request(app)
      .post(`/api/transfers/${manifestId}/receive`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        crushedLoaves: 3,
        notes: 'Top crate crushed during transit over speed bump.',
        supervisorPin: '123456',
      });

    assert.strictEqual(receiveRes.status, 200);
    assert.strictEqual(receiveRes.body.manifest.status, 'RECEIVED');
    assert.strictEqual(receiveRes.body.manifest.receivedLoaves, 97); // 100 - 3
    assert.strictEqual(receiveRes.body.manifest.crushedLoaves, 3);
    // 3 loaves * 15.00 ETB = 45.00 ETB
    assert.strictEqual(Number(receiveRes.body.manifest.driverBilledCost), 45.0);
    assert.strictEqual(receiveRes.body.manifest.supervisorCodeVerified, true);

    // Verify Shelf Stock incremented by intact loaves (+97)
    const updatedStock = await prisma.branchProductStock.findUnique({
      where: {
        branchId_productId: {
          branchId: megenagnaSpoke.id,
          productId: breadProduct.id,
        },
      },
    });

    assert.strictEqual(updatedStock?.availableStock, initialMegenagnaStock + 97);
  });

  it('rejects double-receiving an already received manifest', async () => {
    const createRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sourceBranchId: boleHub.id,
        destinationBranchId: megenagnaSpoke.id,
        productId: breadProduct.id,
        dispatchedLoaves: 50,
        driverId: driverUser.id,
      });
    const manifestId = createRes.body.manifest.id;

    await request(app)
      .post(`/api/transfers/${manifestId}/dispatch`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send();

    await request(app)
      .post(`/api/transfers/${manifestId}/receive`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ crushedLoaves: 0 });

    // Attempt second receive
    const duplicateRes = await request(app)
      .post(`/api/transfers/${manifestId}/receive`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ crushedLoaves: 0 });

    assert.strictEqual(duplicateRes.status, 400);
    assert.match(duplicateRes.body.error, /already been received/i);
  });

  it('rejects crushed loaves exceeding dispatched loaves', async () => {
    const createRes = await request(app)
      .post('/api/transfers')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sourceBranchId: boleHub.id,
        destinationBranchId: megenagnaSpoke.id,
        productId: breadProduct.id,
        dispatchedLoaves: 50,
        driverId: driverUser.id,
      });
    const manifestId = createRes.body.manifest.id;

    await request(app)
      .post(`/api/transfers/${manifestId}/dispatch`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send();

    const invalidRes = await request(app)
      .post(`/api/transfers/${manifestId}/receive`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ crushedLoaves: 100 }); // only 50 were dispatched

    assert.strictEqual(invalidRes.status, 400);
    assert.match(invalidRes.body.error, /cannot exceed/i);
  });

  it('returns metrics with crate counts, loaves in transit and damages', async () => {
    const res = await request(app)
      .get('/api/transfers/metrics')
      .set('Authorization', `Bearer ${ownerToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.totalTransfers > 0);
    assert.ok(res.body.totalCratesMoved > 0);
    assert.ok(res.body.totalDispatchedLoaves > 0);
    assert.strictEqual(typeof res.body.totalDriverBilledCost, 'number');
  });

  it('lists available delivery drivers with branch info', async () => {
    const res = await request(app)
      .get('/api/transfers/drivers')
      .set('Authorization', `Bearer ${ownerToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.drivers));
    assert.ok(res.body.drivers.length > 0);
    assert.ok(res.body.drivers[0].fullName);
  });
});
