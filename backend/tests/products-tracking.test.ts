import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

describe('Developer 2: Front-of-House (Products Catalog & Daily Cash Tracking Workflow)', () => {
  let ownerToken: string;
  let cashierToken: string;
  let cashierUserId: string;
  let megenagnaBranchId: string;
  let boleHubBranchId: string;
  let testProductId: string;
  let createdSaleIds: string[] = [];
  let createdProductIds: string[] = [];

  before(async () => {
    // 1. Authenticate Owner
    const ownerRes = await request(app)
      .post('/api/auth/login')
      .send({ phone: '0911000000', password: 'password123' });
    assert.strictEqual(ownerRes.status, 200);
    ownerToken = ownerRes.body.token;

    // 2. Authenticate Cashier (Megenagna)
    const cashierRes = await request(app)
      .post('/api/auth/login')
      .send({ phone: '0911000011', password: 'password123' });
    assert.strictEqual(cashierRes.status, 200);
    cashierToken = cashierRes.body.token;
    cashierUserId = cashierRes.body.user.id;
    megenagnaBranchId = cashierRes.body.user.branchId;
    assert.ok(megenagnaBranchId, 'Cashier must have branchId');

    // 3. Get Bole Hub branch ID for cross-branch testing
    const boleBranch = await prisma.branch.findUnique({ where: { code: 'BOLE-HUB' } });
    assert.ok(boleBranch);
    boleHubBranchId = boleBranch.id;

    // 4. Guarantee standard bread item exists & is active
    let loaf = await prisma.product.findUnique({ where: { sku: 'BREAD-50G' } });
    if (!loaf) {
      const cat = await prisma.productCategory.findFirst();
      loaf = await prisma.product.create({
        data: {
          name: 'Standard 50g Loaf',
          sku: 'BREAD-50G',
          sellingPrice: 16.5,
          costPrice: 9.5,
          categoryId: cat!.id,
          isActive: true,
        },
      });
    } else {
      await prisma.product.update({ where: { id: loaf.id }, data: { isActive: true, sellingPrice: 16.5 } });
    }
    testProductId = loaf.id;

    // Ensure branch shelf stock for test item
    await prisma.branchProductStock.upsert({
      where: { branchId_productId: { branchId: megenagnaBranchId, productId: testProductId } },
      update: { availableStock: 100 },
      create: { branchId: megenagnaBranchId, productId: testProductId, availableStock: 100 },
    });
  });

  after(async () => {
    // Clean up test sales & test products
    if (createdSaleIds.length > 0) {
      await prisma.saleItem.deleteMany({ where: { saleId: { in: createdSaleIds } } }).catch(() => {});
      await prisma.sale.deleteMany({ where: { id: { in: createdSaleIds } } }).catch(() => {});
    }
    if (createdProductIds.length > 0) {
      await prisma.branchProductStock.deleteMany({ where: { productId: { in: createdProductIds } } }).catch(() => {});
      await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } }).catch(() => {});
    }
    await prisma.$disconnect().catch(() => {});
  });

  // ─── 1. PRODUCT CATALOG MANAGEMENT ──────────────────────────────────────────
  describe('1. Product Catalog & Shelf Stock (/api/products)', () => {
    it('GET /api/products/categories should return available categories', async () => {
      const res = await request(app)
        .get('/api/products/categories')
        .set('Authorization', `Bearer ${cashierToken}`);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.length > 0, 'Should have at least 1 category');
    });

    it('GET /api/products should return product catalog with active branch shelf stock', async () => {
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${cashierToken}`);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));

      const loaf = res.body.find((p: any) => p.sku === 'BREAD-50G');
      assert.ok(loaf, 'Standard loaf should exist in catalog');
      assert.strictEqual(typeof loaf.sellingPrice, 'number');
      assert.strictEqual(typeof loaf.availableStock, 'number');
    });

    it('POST /api/products should allow Owner to create a new bakery product and auto-initialize stock', async () => {
      const categoriesRes = await request(app)
        .get('/api/products/categories')
        .set('Authorization', `Bearer ${ownerToken}`);
      const categoryId = categoriesRes.body[0].id;

      const randomSku = `TEST-PASTRY-${Date.now().toString().slice(-5)}`;
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Butter Croissant',
          sku: randomSku,
          sellingPrice: 75.0,
          costPrice: 42.0,
          categoryId,
          unit: 'PIECE',
          initialStock: 25,
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.name, 'Butter Croissant');
      assert.strictEqual(res.body.sku, randomSku);
      createdProductIds.push(res.body.id);

      // Verify cashier can see it with stock
      const cashierFetch = await request(app)
        .get(`/api/products/${res.body.id}`)
        .set('Authorization', `Bearer ${cashierToken}`);
      assert.strictEqual(cashierFetch.status, 200);
      assert.strictEqual(cashierFetch.body.name, 'Butter Croissant');
    });

    it('Devils Advocate: POST /api/products should strictly FORBID Cashier (403)', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          name: 'Unauthorized Cake',
          sku: 'CAKE-UNAUTH',
          sellingPrice: 500,
          categoryId: 'some-cat',
        });
      assert.strictEqual(res.status, 403);
    });

    it('Devils Advocate: POST /api/products should reject duplicate SKU regardless of casing', async () => {
      const categoriesRes = await request(app)
        .get('/api/products/categories')
        .set('Authorization', `Bearer ${ownerToken}`);
      const categoryId = categoriesRes.body[0].id;

      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Duplicate Loaf',
          sku: 'bread-50g', // Lowercase of BREAD-50G
          sellingPrice: 15.0,
          categoryId,
        });
      assert.strictEqual(res.status, 409);
    });

    it('Devils Advocate: POST /api/products should reject negative or zero selling price', async () => {
      const categoriesRes = await request(app)
        .get('/api/products/categories')
        .set('Authorization', `Bearer ${ownerToken}`);
      const categoryId = categoriesRes.body[0].id;

      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Free Bread',
          sku: 'FREE-BREAD',
          sellingPrice: -10,
          categoryId,
        });
      assert.strictEqual(res.status, 400);
    });

    it('PATCH /api/products/:id should allow Owner to update product pricing', async () => {
      assert.ok(testProductId);
      const res = await request(app)
        .patch(`/api/products/${testProductId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          sellingPrice: 16.5,
        });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.sellingPrice, 16.5);
    });

    it('Devils Advocate: DELETE /api/products/:id should soft-deactivate products with sales history', async () => {
      const categoriesRes = await request(app)
        .get('/api/products/categories')
        .set('Authorization', `Bearer ${ownerToken}`);
      const categoryId = categoriesRes.body[0].id;

      // Create a temporary isolated product for this deletion test
      const tempRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Temp Deletion Test Item',
          sku: `TEMP-DEL-${Date.now().toString().slice(-5)}`,
          sellingPrice: 25.0,
          categoryId,
          initialStock: 10,
        });
      assert.strictEqual(tempRes.status, 201);
      const tempId = tempRes.body.id;
      createdProductIds.push(tempId);

      // Create sales history record directly in database
      const sale = await prisma.sale.create({
        data: {
          receiptNumber: `HIST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          branchId: megenagnaBranchId,
          cashierId: cashierUserId,
          businessDate: '2026-10-31',
          paymentMethod: 'CASH',
          totalAmount: 25.0,
          items: {
            create: [{ productId: tempId, quantity: 1, unitPrice: 25.0, subtotal: 25.0 }],
          },
        },
      });
      createdSaleIds.push(sale.id);

      // Attempt deletion
      const res = await request(app)
        .delete(`/api/products/${tempId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.message.includes('Deactivated successfully'));

      // Verify product is now isActive: false
      const checkRes = await request(app)
        .get(`/api/products/${tempId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      assert.strictEqual(checkRes.body.isActive, false);
    });
  });

  // ─── 2. CONTINUOUS DAILY CASH TRACKING & CLOSEOUT ───────────────────────────
  describe('2. Daily Cash Tracking & Evening Closeout (/api/daily-tracking)', () => {
    it('GET /api/daily-tracking/summary should aggregate sales by tender method for the active branch', async () => {
      const res = await request(app)
        .get('/api/daily-tracking/summary')
        .set('Authorization', `Bearer ${cashierToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.branch.code, 'MEG');
      assert.ok(typeof res.body.totalCashSales === 'number');
      assert.ok(typeof res.body.totalDigitalSales === 'number');
      assert.ok(res.body.totalGrossSales >= res.body.totalCashSales);
    });

    it('Devils Advocate: Cashier CANNOT inspect another branch closeout summary (Zero-Trust 403)', async () => {
      const res = await request(app)
        .get(`/api/daily-tracking/summary?branchId=${boleHubBranchId}`)
        .set('Authorization', `Bearer ${cashierToken}`);
      assert.strictEqual(res.status, 403);
      assert.ok(res.body.error.includes('Forbidden'));
    });

    it('Devils Advocate: Cashier CANNOT submit closeout for another branch (Zero-Trust 403)', async () => {
      const res = await request(app)
        .post('/api/daily-tracking/closeout')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          branchId: boleHubBranchId,
          startingFloat: 500,
          actualCountedCash: 500,
        });
      assert.strictEqual(res.status, 403);
      assert.ok(res.body.error.includes('Forbidden'));
    });

    it('Devils Advocate: Closeout calculation must precisely compute Cash Shortage (negative variance)', async () => {
      const summaryRes = await request(app)
        .get('/api/daily-tracking/summary')
        .set('Authorization', `Bearer ${cashierToken}`);

      const cashSales = summaryRes.body.totalCashSales;
      const startingFloat = 1000;
      const expenses = 100;
      const expectedCash = startingFloat + cashSales - expenses;
      const actualCountedCash = expectedCash - 75; // Cashier is short by 75 ETB

      const res = await request(app)
        .post('/api/daily-tracking/closeout')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          startingFloat,
          totalExpenses: expenses,
          actualCountedCash,
          notes: 'Devils advocate shortage test',
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.expectedCash, expectedCash);
      assert.strictEqual(res.body.actualCountedCash, actualCountedCash);
      assert.strictEqual(res.body.variance, -75, 'Variance must accurately report -75.00 shortage');
    });

    it('Devils Advocate: Closeout calculation must precisely compute Cash Overage (positive variance)', async () => {
      const summaryRes = await request(app)
        .get('/api/daily-tracking/summary')
        .set('Authorization', `Bearer ${cashierToken}`);

      const cashSales = summaryRes.body.totalCashSales;
      const startingFloat = 1000;
      const expenses = 50;
      const expectedCash = startingFloat + cashSales - expenses;
      const actualCountedCash = expectedCash + 120; // Cashier has overage of 120 ETB

      const res = await request(app)
        .post('/api/daily-tracking/closeout')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          startingFloat,
          totalExpenses: expenses,
          actualCountedCash,
          notes: 'Devils advocate overage test',
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.expectedCash, expectedCash);
      assert.strictEqual(res.body.actualCountedCash, actualCountedCash);
      assert.strictEqual(res.body.variance, 120, 'Variance must accurately report +120.00 overage');
    });

    it('Continuous Workflow: Cashier can update/re-submit closeout post-closeout with zero lockout', async () => {
      const subsequentCloseout = await request(app)
        .post('/api/daily-tracking/closeout')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          startingFloat: 1000,
          totalExpenses: 70,
          actualCountedCash: 1200,
          notes: 'Continuous workflow adjustment',
        });
      assert.strictEqual(subsequentCloseout.status, 200, 'Continuous workflow must allow adjustments');
    });

    it('GET /api/daily-tracking/history should return historical audit trail of daily closeouts', async () => {
      const res = await request(app)
        .get('/api/daily-tracking/history')
        .set('Authorization', `Bearer ${cashierToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.length >= 1, 'Should return at least the closeout records submitted');
    });
  });
});
