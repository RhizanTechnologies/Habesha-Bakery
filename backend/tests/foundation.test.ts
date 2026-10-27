import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import bcrypt from 'bcryptjs';

describe('Habesha Bakery ERP - Standard Auth & Foundation Test Suite', () => {
  let ownerToken: string;
  let cashierToken: string;
  let managerToken: string;
  let cashierBranchId: string;
  let boleHubBranchId: string;
  let testUserId: string;

  const createdUserIds: string[] = [];
  const createdBranchIds: string[] = [];

  after(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
    }
    if (createdBranchIds.length > 0) {
      await prisma.branch.deleteMany({ where: { id: { in: createdBranchIds } } }).catch(() => {});
    }
  });

  // 1. Health & Company Metadata
  describe('1. System Health & Dynamic Profile', () => {
    it('GET /api/health should return ok status', async () => {
      const res = await request(app).get('/api/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
      assert.ok(res.body.timestamp);
    });

    it('GET /api/company should return live metrics and company details', async () => {
      const res = await request(app).get('/api/company');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.company);
      assert.ok(res.body.company.name.includes('Habesha Bakery'));
      assert.ok(typeof res.body.company.totalBranches === 'number');
      assert.ok(typeof res.body.company.totalUsers === 'number');
      assert.ok(res.body.company.totalBranches >= 5);
      assert.ok(res.body.company.totalUsers >= 10);
    });
  });

  // 2. Standard Phone + Password Login
  describe('2. Authentication: Standard Phone + Password', () => {
    it('should authenticate Owner and grant global authority', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ phone: '0911000000', password: 'password123' });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.token);
      assert.strictEqual(res.body.user.role, 'OWNER');
      ownerToken = res.body.token;
    });

    it('should authenticate Megenagna Cashier and bind to Megenagna branch', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ phone: '0911000011', password: 'password123' });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.token);
      assert.strictEqual(res.body.user.role, 'CASHIER');
      assert.ok(res.body.user.branch);
      assert.strictEqual(res.body.user.branch.code, 'MEG');

      cashierToken = res.body.token;
      cashierBranchId = res.body.user.branch.id;
    });

    it('should authenticate Branch Manager (Megenagna)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ phone: '0911000012', password: 'password123' });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.token);
      assert.strictEqual(res.body.user.role, 'BRANCH_MANAGER');
      managerToken = res.body.token;
    });

    it('should reject invalid password with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ phone: '0911000000', password: 'wrong-password' });

      assert.strictEqual(res.status, 401);
      assert.ok(res.body.error);
    });

    it('should reject non-existent user phone with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ phone: '0999999999', password: 'password123' });

      assert.strictEqual(res.status, 401);
      assert.ok(res.body.error);
    });

    it('should reject empty or missing credentials with 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      assert.strictEqual(res.status, 400);
    });

    it('Devils Advocate: should safely neutralize SQL injection style payloads', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ phone: "' OR '1'='1", password: "' OR '1'='1" });

      assert.strictEqual(res.status, 401);
    });
  });

  // 3. Protected Session & Token Verification (/api/auth/me)
  describe('3. Session Verification & Protected Profile', () => {
    it('should return profile with branch details for valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${cashierToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.user.phone, '0911000011');
      assert.strictEqual(res.body.user.branch.code, 'MEG');
    });

    it('should reject unauthenticated request without token with 401', async () => {
      const res = await request(app).get('/api/auth/me');
      assert.strictEqual(res.status, 401);
    });

    it('should reject malformed or tampered token with 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer forged.token.signature');

      assert.strictEqual(res.status, 401);
    });
  });

  // 4. Devils Advocate: Account Deactivation Enforcement
  describe('4. Devils Advocate: Deactivated Account Enforcement', () => {
    const deactPhone = '0988112233';

    before(async () => {
      const hash = await bcrypt.hash('password123', 10);
      const user = await prisma.user.create({
        data: {
          fullName: 'Deactivated Worker',
          phone: deactPhone,
          passwordHash: hash,
          role: 'CASHIER',
          branchId: cashierBranchId,
          isActive: false,
        },
      });
      createdUserIds.push(user.id);
    });

    it('should reject login attempt for deactivated user with 403', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ phone: deactPhone, password: 'password123' });

      assert.strictEqual(res.status, 403);
      assert.match(res.body.error, /deactivated/i);
    });

    it('should revoke active session token immediately if account is deactivated in DB mid-session', async () => {
      const activePhone = '0988445566';
      const hash = await bcrypt.hash('password123', 10);
      const tempUser = await prisma.user.create({
        data: {
          fullName: 'Temporarily Active Staff',
          phone: activePhone,
          passwordHash: hash,
          role: 'CASHIER',
          branchId: cashierBranchId,
          isActive: true,
        },
      });
      createdUserIds.push(tempUser.id);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ phone: activePhone, password: 'password123' });
      assert.strictEqual(loginRes.status, 200);
      const validToken = loginRes.body.token;

      // Deactivate mid-session
      await prisma.user.update({
        where: { id: tempUser.id },
        data: { isActive: false },
      });

      // Query protected endpoint
      const reqRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      assert.strictEqual(reqRes.status, 401);
      assert.match(reqRes.body.error, /deactivated/i);
    });
  });

  // 5. Devils Advocate: Inactive Branch Enforcement
  describe('5. Devils Advocate: Inactive Branch Enforcement', () => {
    let inactiveBranchId: string;
    const staffAtInactiveBranchPhone = '0977334455';

    before(async () => {
      const comp = await prisma.company.findFirst();
      const branch = await prisma.branch.create({
        data: {
          name: 'Closed Down Spoke',
          code: 'CLS' + Math.floor(Math.random() * 899 + 100),
          isHub: false,
          isActive: false,
          companyId: comp!.id,
        },
      });
      inactiveBranchId = branch.id;
      createdBranchIds.push(branch.id);

      const hash = await bcrypt.hash('password123', 10);
      const user = await prisma.user.create({
        data: {
          fullName: 'Staff At Closed Branch',
          phone: staffAtInactiveBranchPhone,
          passwordHash: hash,
          role: 'CASHIER',
          branchId: branch.id,
          isActive: true,
        },
      });
      createdUserIds.push(user.id);
    });

    it('should block staff login if their assigned branch is inactive with 403', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ phone: staffAtInactiveBranchPhone, password: 'password123' });

      assert.strictEqual(res.status, 403);
      assert.match(res.body.error, /branch is currently inactive/i);
    });

    it('Global OWNER should still authenticate and manage even if branches are inactive', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ phone: '0911000000', password: 'password123' });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.user.role, 'OWNER');
    });
  });

  // 6. Branch Scoping & Strict Cross-Branch Isolation
  describe('6. Branch Scoping & Zero-Trust Isolation: /api/branches', () => {
    it('OWNER should see all active branches across the enterprise', async () => {
      const res = await request(app)
        .get('/api/branches')
        .set('Authorization', `Bearer ${ownerToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.branches));
      assert.ok(res.body.branches.length >= 5);
    });

    it('Cashier must ONLY see their own assigned branch (Zero Visibility into others)', async () => {
      const res = await request(app)
        .get('/api/branches')
        .set('Authorization', `Bearer ${cashierToken}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.branches.length, 1);
      assert.strictEqual(res.body.branches[0].id, cashierBranchId);
      assert.strictEqual(res.body.branches[0].code, 'MEG');
    });

    it('Devils Advocate: Cashier must be FORBIDDEN (403) from accessing another branch by ID', async () => {
      const res = await request(app)
        .get(`/api/branches/${boleHubBranchId}`)
        .set('Authorization', `Bearer ${cashierToken}`);

      assert.strictEqual(res.status, 403);
      assert.match(res.body.error, /access denied/i);
    });

    it('POST /api/branches should allow OWNER to create a new branch', async () => {
      const code = 'TST' + Math.floor(Math.random() * 899 + 100);
      const res = await request(app)
        .post('/api/branches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Piazza Expansion Spoke',
          code,
          isHub: false,
          address: 'Piazza, Addis Ababa',
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.branch.code, code);
      createdBranchIds.push(res.body.branch.id);
    });

    it('Devils Advocate: POST /api/branches should strictly deny Cashier with 403', async () => {
      const res = await request(app)
        .post('/api/branches')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          name: 'Illicit Branch',
          code: 'ILL' + Math.floor(Math.random() * 899 + 100),
        });

      assert.strictEqual(res.status, 403);
    });

    it('Devils Advocate: POST /api/branches should reject duplicate branch code with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/branches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Duplicate Bole Hub',
          code: 'BOLE-HUB',
        });

      assert.strictEqual(res.status, 409);
      assert.match(res.body.error, /already in use/i);
    });
  });

  // 7. Staff Management, Branch Scoping & Role Boundaries
  describe('7. Staff Management & Role Boundaries: /api/users', () => {
    it('OWNER should list all staff across the entire company', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${ownerToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.users));
      assert.ok(res.body.users.length >= 10);
    });

    it('Cashier must ONLY see staff members within their own branch', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${cashierToken}`);

      assert.strictEqual(res.status, 200);
      for (const u of res.body.users) {
        assert.strictEqual(u.branchId, cashierBranchId);
      }
    });

    it('Devils Advocate: Cashier must be FORBIDDEN from creating staff members', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${cashierToken}`)
        .send({
          fullName: 'Unauthorized Cashier Hire',
          phone: '0977000000',
          password: 'password123',
          role: 'CASHIER',
        });

      assert.strictEqual(res.status, 403);
    });

    it('POST /api/users should allow OWNER to create a staff member with password', async () => {
      const uniquePhone = '09' + Math.floor(10000000 + Math.random() * 89999999);
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          fullName: 'Artisan Pastry Baker',
          phone: uniquePhone,
          password: 'securePassword2026',
          role: 'BAKER',
          branchId: boleHubBranchId,
          salary: 21000,
          shift: 'DAY',
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.user.phone, uniquePhone);
      testUserId = res.body.user.id;
      createdUserIds.push(testUserId);
    });

    it('Devils Advocate: POST /api/users should reject passwords shorter than 6 characters with 400', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          fullName: 'Weak Pass Baker',
          phone: '09' + Math.floor(10000000 + Math.random() * 89999999),
          password: '123',
          role: 'BAKER',
        });

      assert.strictEqual(res.status, 400);
      assert.match(res.body.error, /minimum of 6 characters/i);
    });

    it('Devils Advocate: POST /api/users should reject duplicate phone with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          fullName: 'Duplicate Owner Clone',
          phone: '0911000000',
          password: 'securePassword2026',
          role: 'CASHIER',
        });

      assert.strictEqual(res.status, 409);
      assert.match(res.body.error, /already exists/i);
    });

    it('Devils Advocate: Branch Manager cannot reset password for staff at another branch', async () => {
      // Create user at Bole Hub (different branch than Megenagna Manager)
      const boleStaffPhone = '09' + Math.floor(10000000 + Math.random() * 89999999);
      const hash = await bcrypt.hash('password123', 10);
      const boleUser = await prisma.user.create({
        data: {
          fullName: 'Bole Hub Helper',
          phone: boleStaffPhone,
          passwordHash: hash,
          role: 'BAKER',
          branchId: boleHubBranchId,
        },
      });
      createdUserIds.push(boleUser.id);

      // Megenagna Manager tries to reset Bole Hub employee password
      const res = await request(app)
        .patch(`/api/users/${boleUser.id}/password`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ newPassword: 'managerReset123' });

      assert.strictEqual(res.status, 403);
      assert.match(res.body.error, /another branch/i);
    });

    it('PATCH /api/users/:id/password should allow Owner to reset any employee password', async () => {
      const res = await request(app)
        .patch(`/api/users/${testUserId}/password`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ newPassword: 'adminResetValidPass2026' });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.message);
    });
  });

  // 8. Self-Service Password Lifecycle
  describe('8. Self-Service Password Lifecycle: PATCH /api/auth/password', () => {
    const selfTestPhone = '09' + Math.floor(10000000 + Math.random() * 89999999);
    let selfToken: string;

    before(async () => {
      const hash = await bcrypt.hash('initialPass123', 10);
      const user = await prisma.user.create({
        data: {
          fullName: 'Self Service User',
          phone: selfTestPhone,
          passwordHash: hash,
          role: 'CASHIER',
          branchId: cashierBranchId,
        },
      });
      createdUserIds.push(user.id);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ phone: selfTestPhone, password: 'initialPass123' });
      selfToken = loginRes.body.token;
    });

    it('should reject password update if current password is incorrect (401)', async () => {
      const res = await request(app)
        .patch('/api/auth/password')
        .set('Authorization', `Bearer ${selfToken}`)
        .send({ currentPassword: 'wrongInitialPass', newPassword: 'brandNewPassword123' });

      assert.strictEqual(res.status, 401);
      assert.match(res.body.error, /incorrect current password/i);
    });

    it('should reject password update if new password is too short (400)', async () => {
      const res = await request(app)
        .patch('/api/auth/password')
        .set('Authorization', `Bearer ${selfToken}`)
        .send({ currentPassword: 'initialPass123', newPassword: '123' });

      assert.strictEqual(res.status, 400);
      assert.match(res.body.error, /at least 6 characters/i);
    });

    it('should allow user to update password with valid credentials', async () => {
      const res = await request(app)
        .patch('/api/auth/password')
        .set('Authorization', `Bearer ${selfToken}`)
        .send({ currentPassword: 'initialPass123', newPassword: 'brandNewPassword123' });

      assert.strictEqual(res.status, 200);
      assert.match(res.body.message, /updated successfully/i);

      // Old password must fail
      const oldLogin = await request(app)
        .post('/api/auth/login')
        .send({ phone: selfTestPhone, password: 'initialPass123' });
      assert.strictEqual(oldLogin.status, 401);

      // New password must succeed
      const newLogin = await request(app)
        .post('/api/auth/login')
        .send({ phone: selfTestPhone, password: 'brandNewPassword123' });
      assert.strictEqual(newLogin.status, 200);
      assert.ok(newLogin.body.token);
    });
  });
});
