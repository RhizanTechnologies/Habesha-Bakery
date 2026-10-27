import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

describe('Layer 2: Warehouse Inventory & Scale Disbursements (/api/inventory)', () => {
  let storekeeperToken: string;
  let cashierToken: string;
  let flourMaterialId: string;
  let yeastMaterialId: string;
  let boleHubBranchId: string;

  before(async () => {
    // 1. Authenticate Storekeeper (Solomon Storekeeper: 0911000001)
    const skRes = await request(app)
      .post('/api/auth/login')
      .send({ phone: '0911000001', password: 'password123' });
    assert.strictEqual(skRes.status, 200);
    storekeeperToken = skRes.body.token;

    // 2. Authenticate Cashier (Selam Cashier: 0911000011)
    const cRes = await request(app)
      .post('/api/auth/login')
      .send({ phone: '0911000011', password: 'password123' });
    assert.strictEqual(cRes.status, 200);
    cashierToken = cRes.body.token;

    // 3. Resolve Bole Hub and Raw Materials
    const hub = await prisma.branch.findUnique({ where: { code: 'BOLE-HUB' } });
    assert.ok(hub);
    boleHubBranchId = hub.id;

    const flour = await prisma.rawMaterial.findUnique({ where: { sku: 'MAT-FLOUR-50KG' } });
    assert.ok(flour);
    flourMaterialId = flour.id;

    const yeast = await prisma.rawMaterial.findUnique({ where: { sku: 'MAT-YEAST-KG' } });
    assert.ok(yeast);
    yeastMaterialId = yeast.id;
  });

  it('1. GET /api/inventory/stock should return current warehouse balances', async () => {
    const res = await request(app)
      .get('/api/inventory/stock')
      .set('Authorization', `Bearer ${storekeeperToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.stocks));
    assert.ok(res.body.stocks.length >= 5);

    const flourItem = res.body.stocks.find((s: any) => s.id === flourMaterialId);
    assert.ok(flourItem);
    assert.strictEqual(flourItem.unit, 'BAG');
    assert.ok(typeof flourItem.currentQuantity === 'number');
  });

  it('2. POST /api/inventory/ingest should accept incoming flour delivery from supplier', async () => {
    const stockBefore = await prisma.rawMaterialStock.findUnique({
      where: {
        branchId_rawMaterialId: {
          branchId: boleHubBranchId,
          rawMaterialId: flourMaterialId,
        },
      },
    });
    const qtyBefore = Number(stockBefore?.quantity || 0);

    const res = await request(app)
      .post('/api/inventory/ingest')
      .set('Authorization', `Bearer ${storekeeperToken}`)
      .send({
        branchId: boleHubBranchId,
        rawMaterialId: flourMaterialId,
        quantity: 20,
        notes: 'Supplier ABC delivery batch #2026',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.stock.currentQuantity, qtyBefore + 20);
  });

  it('3. POST /api/inventory/disburse should scale and issue flour + yeast to kitchen', async () => {
    const flourStockBefore = await prisma.rawMaterialStock.findUnique({
      where: {
        branchId_rawMaterialId: {
          branchId: boleHubBranchId,
          rawMaterialId: flourMaterialId,
        },
      },
    });
    const flourBefore = Number(flourStockBefore?.quantity || 0);

    const res = await request(app)
      .post('/api/inventory/disburse')
      .set('Authorization', `Bearer ${storekeeperToken}`)
      .send({
        branchId: boleHubBranchId,
        department: 'KITCHEN',
        notes: 'Morning baking shift run',
        items: [
          { rawMaterialId: flourMaterialId, quantity: 4 }, // 4 sacks = 200 kg
          { rawMaterialId: yeastMaterialId, quantity: 2 }, // 2 kg
        ],
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.disbursement.items.length, 2);

    // Verify stock decremented in DB
    const flourStockAfter = await prisma.rawMaterialStock.findUnique({
      where: {
        branchId_rawMaterialId: {
          branchId: boleHubBranchId,
          rawMaterialId: flourMaterialId,
        },
      },
    });
    assert.strictEqual(Number(flourStockAfter?.quantity), flourBefore - 4);
  });

  it('4. Devils Advocate: Overdraft rejection when scaling more sacks than warehouse holds', async () => {
    const res = await request(app)
      .post('/api/inventory/disburse')
      .set('Authorization', `Bearer ${storekeeperToken}`)
      .send({
        branchId: boleHubBranchId,
        department: 'KITCHEN',
        items: [
          { rawMaterialId: flourMaterialId, quantity: 99999 }, // Astronomical overdraft
        ],
      });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('Insufficient warehouse stock'));
  });

  it('5. Devils Advocate: Cashier must be strictly forbidden (403) from warehouse disbursement', async () => {
    const res = await request(app)
      .post('/api/inventory/disburse')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({
        branchId: boleHubBranchId,
        department: 'KITCHEN',
        items: [{ rawMaterialId: flourMaterialId, quantity: 1 }],
      });

    assert.strictEqual(res.status, 403);
  });

  it('6. GET /api/inventory/disbursements should list recent scale manifests', async () => {
    const res = await request(app)
      .get('/api/inventory/disbursements')
      .set('Authorization', `Bearer ${storekeeperToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.disbursements));
    assert.ok(res.body.disbursements.length >= 1);
    assert.strictEqual(res.body.disbursements[0].department, 'KITCHEN');
    assert.ok(res.body.disbursements[0].items.length > 0);
  });
});
