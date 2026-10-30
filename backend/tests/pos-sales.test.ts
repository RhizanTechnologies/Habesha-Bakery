import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

describe('Developer 2: Front-of-House (Products, POS Touchscreen & Daily Cash Tracking)', () => {
  let ownerToken: string;
  let cashierToken: string;
  let megenagnaBranchId: string;
  let testProductId: string;
  let createdSaleIds: string[] = [];

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
    megenagnaBranchId = cashierRes.body.user.branchId;
    assert.ok(megenagnaBranchId, 'Cashier must have branchId');
  });

  after(async () => {
    // Clean up test sales
    if (createdSaleIds.length > 0) {
      await prisma.saleItem.deleteMany({ where: { saleId: { in: createdSaleIds } } }).catch(() => {});
      await prisma.sale.deleteMany({ where: { id: { in: createdSaleIds } } }).catch(() => {});
    }
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
      assert.ok(res.body.length >= 4, 'Should return at least the 4 standard bakery items');

      const loaf = res.body.find((p: any) => p.sku === 'BREAD-50G');
      assert.ok(loaf, 'Standard loaf should exist in catalog');
      assert.strictEqual(typeof loaf.sellingPrice, 'number');
      assert.strictEqual(typeof loaf.availableStock, 'number');
      testProductId = loaf.id;
    });

    it('POST /api/products should allow Owner to create a new bakery product and auto-initialize stock', async () => {
      const categoriesRes = await request(app)
        .get('/api/products/categories')
        .set('Authorization', `Bearer ${ownerToken}`);
      const categoryId = categoriesRes.body[0].id;

      const randomSku = `TEST-CROISSANT-${Date.now().toString().slice(-5)}`;
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
  });

  // ─── 2. FAST COUNTER POS CHECKOUT ───────────────────────────────────────────
  describe('2. Counter POS Touchscreen & Multi-Tender Sales (/api/pos)', () => {
    it('POST /api/pos/orders should process cash checkout, generate sequential receipt and decrement shelf stock', async () => {
      // Check current shelf stock before sale
      const beforeRes = await request(app)
        .get(`/api/products/${testProductId}`)
        .set('Authorization', `Bearer ${cashierToken}`);
      const stockBefore = beforeRes.body.availableStock;

      const res = await request(app)
        .post('/api/pos/orders')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          paymentMethod: 'CASH',
          items: [
            { productId: testProductId, quantity: 3 }
          ],
          customerName: 'Ato Abebe Retail',
        });

      assert.strictEqual(res.status, 201);
      assert.ok(res.body.receiptNumber.startsWith('REC-MEG-'), 'Receipt must use branch code REC-MEG-');
      assert.strictEqual(res.body.paymentMethod, 'CASH');
      assert.strictEqual(res.body.items.length, 1);
      assert.strictEqual(res.body.items[0].quantity, 3);
      createdSaleIds.push(res.body.id);

      // Verify stock was decremented by 3
      const afterRes = await request(app)
        .get(`/api/products/${testProductId}`)
        .set('Authorization', `Bearer ${cashierToken}`);
      assert.strictEqual(afterRes.body.availableStock, stockBefore - 3);
    });

    it('POST /api/pos/orders should support digital tenders (TELEBIRR and CBE)', async () => {
      const res = await request(app)
        .post('/api/pos/orders')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          paymentMethod: 'TELEBIRR',
          items: [
            { productId: testProductId, quantity: 1 }
          ],
          customerPhone: '0922334455',
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.paymentMethod, 'TELEBIRR');
      createdSaleIds.push(res.body.id);
    });

    it('Devils Advocate: POST /api/pos/orders should reject checkout with empty cart (400)', async () => {
      const res = await request(app)
        .post('/api/pos/orders')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          paymentMethod: 'CASH',
          items: [],
        });
      assert.strictEqual(res.status, 400);
    });

    it('GET /api/pos/orders/today should return today sales feed and cashier shift stats', async () => {
      const res = await request(app)
        .get('/api/pos/orders/today')
        .set('Authorization', `Bearer ${cashierToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.summary, 'Must return summary stats');
      assert.ok(res.body.summary.totalOrders >= 2);
      assert.ok(res.body.summary.totalGross > 0);
      assert.ok(Array.isArray(res.body.orders));
    });
  });

  // ─── 3. CONTINUOUS DAILY CASH TRACKING & CLOSEOUT ───────────────────────────
  describe('3. Daily Cash Tracking & Evening Closeout (/api/daily-tracking)', () => {
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

    it('POST /api/daily-tracking/closeout should compute variance (Counted - Expected) and save reconciliation without terminal lock', async () => {
      const summaryRes = await request(app)
        .get('/api/daily-tracking/summary')
        .set('Authorization', `Bearer ${cashierToken}`);

      const cashSales = summaryRes.body.totalCashSales;
      const startingFloat = 500;
      const expenses = 50;
      const expectedCash = startingFloat + cashSales - expenses;
      const actualCountedCash = expectedCash; // Perfect match

      const res = await request(app)
        .post('/api/daily-tracking/closeout')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          startingFloat,
          totalExpenses: expenses,
          actualCountedCash,
          notes: 'Shift balanced successfully with 0 variance',
        });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.expectedCash, expectedCash);
      assert.strictEqual(res.body.actualCountedCash, actualCountedCash);
      assert.strictEqual(res.body.variance, 0, 'Variance must be 0 for exact match');

      // Continuous Date: Cashier should STILL be able to checkout immediately after closeout without lockout
      const subsequentSale = await request(app)
        .post('/api/pos/orders')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          paymentMethod: 'CASH',
          items: [{ productId: testProductId, quantity: 1 }],
        });
      assert.strictEqual(subsequentSale.status, 201, 'Continuous workflow must allow post-closeout operations');
      createdSaleIds.push(subsequentSale.body.id);
    });

    it('GET /api/daily-tracking/history should return historical audit trail of daily closeouts', async () => {
      const res = await request(app)
        .get('/api/daily-tracking/history')
        .set('Authorization', `Bearer ${cashierToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.length >= 1, 'Should return at least the closeout just submitted');
    });
  });
});
