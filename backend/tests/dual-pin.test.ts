import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/app.js';
import { Role } from '@prisma/client';

describe('Layer 1 Foundation: Dual-PIN Security & Supervisor Authorization', () => {
  let ownerToken: string;
  let cashierToken: string;

  it('1. Quick PIN Login: Cashier unlocks tablet with 4-digit PIN', async () => {
    const res = await request(app)
      .post('/api/auth/pin-login')
      .send({ phone: '0911000011', pin: '1234' });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.role, Role.CASHIER);
    assert.strictEqual(res.body.user.hasPin, true);
    cashierToken = res.body.token;
  });

  it('2. Quick PIN Login: Owner unlocks with 4-digit PIN', async () => {
    const res = await request(app)
      .post('/api/auth/pin-login')
      .send({ phone: '0911000000', pin: '1234' });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.role, Role.OWNER);
    assert.strictEqual(res.body.user.hasManagerApprovalPin, true);
    ownerToken = res.body.token;
  });

  it('3. Devils Advocate: Should reject PIN that is not exactly 4 digits', async () => {
    const res1 = await request(app)
      .post('/api/auth/pin-login')
      .send({ phone: '0911000011', pin: '123' }); // 3 digits
    assert.strictEqual(res1.status, 400);

    const res2 = await request(app)
      .post('/api/auth/pin-login')
      .send({ phone: '0911000011', pin: '12345' }); // 5 digits
    assert.strictEqual(res2.status, 400);

    const res3 = await request(app)
      .post('/api/auth/pin-login')
      .send({ phone: '0911000011', pin: 'abcd' }); // non-numeric
    assert.strictEqual(res3.status, 400);
  });

  it('4. Devils Advocate: Should reject incorrect 4-digit PIN with 401', async () => {
    const res = await request(app)
      .post('/api/auth/pin-login')
      .send({ phone: '0911000011', pin: '9999' });

    assert.strictEqual(res.status, 401);
  });

  it('5. Supervisor Approval: Verify valid 6-digit approval code for Owner', async () => {
    const res = await request(app)
      .post('/api/auth/verify-supervisor-pin')
      .send({ supervisorPhone: '0911000000', pin: '123456' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.verified, true);
    assert.strictEqual(res.body.supervisor.role, Role.OWNER);
  });

  it('6. Supervisor Approval: Verify valid 6-digit approval code for Branch Manager', async () => {
    const res = await request(app)
      .post('/api/auth/verify-supervisor-pin')
      .send({ supervisorPhone: '0911000012', pin: '123456' }); // Dawit Megenagna Manager

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.verified, true);
    assert.strictEqual(res.body.supervisor.role, Role.BRANCH_MANAGER);
  });

  it('7. Devils Advocate: Non-supervisor (Cashier) cannot verify supervisor code', async () => {
    const res = await request(app)
      .post('/api/auth/verify-supervisor-pin')
      .send({ supervisorPhone: '0911000011', pin: '123456' }); // Cashier

    assert.strictEqual(res.status, 401);
  });

  it('8. Devils Advocate: Should reject wrong 6-digit supervisor code with 401', async () => {
    const res = await request(app)
      .post('/api/auth/verify-supervisor-pin')
      .send({ supervisorPhone: '0911000000', pin: '654321' });

    assert.strictEqual(res.status, 401);
  });

  it('9. Devils Advocate: Should reject supervisor code with invalid length', async () => {
    const res = await request(app)
      .post('/api/auth/verify-supervisor-pin')
      .send({ supervisorPhone: '0911000000', pin: '1234' }); // only 4 digits

    assert.strictEqual(res.status, 400);
  });

  it('10. Admin Reset Staff PINs: Owner updates cashier quick PIN to 4321', async () => {
    // 1. Get Cashier user ID
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${cashierToken}`);
    const cashierId = meRes.body.id;

    // 2. Owner updates PIN
    const updateRes = await request(app)
      .patch(`/api/users/${cashierId}/pins`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ pin: '4321' });

    assert.strictEqual(updateRes.status, 200);

    // 3. Old PIN should now fail
    const oldRes = await request(app)
      .post('/api/auth/pin-login')
      .send({ phone: '0911000011', pin: '1234' });
    assert.strictEqual(oldRes.status, 401);

    // 4. New PIN succeeds
    const newRes = await request(app)
      .post('/api/auth/pin-login')
      .send({ phone: '0911000011', pin: '4321' });
    assert.strictEqual(newRes.status, 200);

    // Reset back to 1234 for subsequent tests
    await request(app)
      .patch(`/api/users/${cashierId}/pins`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ pin: '1234' });
  });
});
