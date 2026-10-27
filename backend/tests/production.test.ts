import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

describe('Layer 2: Baking Engine & 1,362 Loaf Yield Physics (/api/production)', () => {
  let bakerToken: string;
  let boleHubBranchId: string;
  let breadProductId: string;

  before(async () => {
    // 1. Authenticate Master Baker (Tadesse Master Baker: 0911000003)
    const bRes = await request(app)
      .post('/api/auth/login')
      .send({ phone: '0911000003', password: 'password123' });
    assert.strictEqual(bRes.status, 200);
    bakerToken = bRes.body.token;

    // 2. Resolve Bole Hub and Bread Product
    const hub = await prisma.branch.findUnique({ where: { code: 'BOLE-HUB' } });
    assert.ok(hub);
    boleHubBranchId = hub.id;

    const bread = await prisma.product.findUnique({ where: { sku: 'BREAD-50G' } });
    assert.ok(bread);
    breadProductId = bread.id;
  });

  it('1. POST /api/production/batches: 4 sacks yields exactly 5,448 loaves (100% Optimal Yield)', async () => {
    const res = await request(app)
      .post('/api/production/batches')
      .set('Authorization', `Bearer ${bakerToken}`)
      .send({
        branchId: boleHubBranchId,
        productId: breadProductId,
        flourSacksUsed: 4,
        actualLoavesBaked: 5448,
        damagedLoaves: 12,
        shift: 'DAY',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.batch.flourSacksUsed, '4');
    assert.strictEqual(res.body.batch.expectedLoaves, 5448);
    assert.strictEqual(res.body.batch.actualLoavesBaked, 5448);
    assert.strictEqual(Number(res.body.batch.yieldEfficiency), 100);
    assert.strictEqual(res.body.batch.isFlagged, false);
    assert.strictEqual(res.body.batch.flagReason, null);
  });

  it('2. POST /api/production/batches: Low Yield Anomaly (<90%) triggers automated RED WARNING FLAG', async () => {
    // 4 sacks expected 5,448 loaves, but only 4,000 loaves baked (73.42% efficiency)
    const res = await request(app)
      .post('/api/production/batches')
      .set('Authorization', `Bearer ${bakerToken}`)
      .send({
        branchId: boleHubBranchId,
        productId: breadProductId,
        flourSacksUsed: 4,
        actualLoavesBaked: 4000,
        damagedLoaves: 35,
        shift: 'NIGHT',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.batch.expectedLoaves, 5448);
    assert.strictEqual(res.body.batch.actualLoavesBaked, 4000);
    assert.strictEqual(Number(res.body.batch.yieldEfficiency), 73.42);
    assert.strictEqual(res.body.batch.isFlagged, true);
    assert.ok(res.body.batch.flagReason.includes('Low yield anomaly'));
  });

  it('3. POST /api/production/batches: Supports fractional sacks (2.5 sacks -> 3,405 loaves)', async () => {
    // 2.5 * 1362 = 3405
    const res = await request(app)
      .post('/api/production/batches')
      .set('Authorization', `Bearer ${bakerToken}`)
      .send({
        branchId: boleHubBranchId,
        productId: breadProductId,
        flourSacksUsed: 2.5,
        actualLoavesBaked: 3405,
        shift: 'DAY',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.batch.expectedLoaves, 3405);
    assert.strictEqual(Number(res.body.batch.yieldEfficiency), 100);
    assert.strictEqual(res.body.batch.isFlagged, false);
  });

  it('4. Devils Advocate: Reject negative sacks or zero loaves with 400', async () => {
    const res1 = await request(app)
      .post('/api/production/batches')
      .set('Authorization', `Bearer ${bakerToken}`)
      .send({
        branchId: boleHubBranchId,
        flourSacksUsed: -2,
        actualLoavesBaked: 1000,
      });
    assert.strictEqual(res1.status, 400);

    const res2 = await request(app)
      .post('/api/production/batches')
      .set('Authorization', `Bearer ${bakerToken}`)
      .send({
        branchId: boleHubBranchId,
        flourSacksUsed: 2,
        actualLoavesBaked: 0,
      });
    assert.strictEqual(res2.status, 400);
  });

  it('5. GET /api/production/metrics: Returns aggregated yield stats and flagged count', async () => {
    const res = await request(app)
      .get('/api/production/metrics')
      .set('Authorization', `Bearer ${bakerToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.totalBatches >= 3);
    assert.ok(res.body.totalLoavesBaked >= 12000);
    assert.ok(res.body.flaggedCount >= 1);
    assert.ok(typeof res.body.averageEfficiency === 'number');
  });

  it('6. GET /api/production/batches: Filter by isFlagged=true returns only anomaly batches', async () => {
    const res = await request(app)
      .get('/api/production/batches?isFlagged=true')
      .set('Authorization', `Bearer ${bakerToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.batches));
    assert.ok(res.body.batches.length >= 1);
    assert.strictEqual(res.body.batches.every((b: any) => b.isFlagged === true), true);
  });
});
