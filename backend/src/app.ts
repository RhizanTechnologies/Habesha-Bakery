import express from 'express';
import cors from 'cors';
import path from 'path';
import { authRouter } from './modules/auth/auth.controller.js';
import { branchesRouter } from './modules/branches/branches.controller.js';
import { usersRouter } from './modules/users/users.controller.js';
import { companyRouter } from './modules/company/company.controller.js';
import { inventoryRouter } from './modules/inventory/inventory.controller.js';
import { productionRouter } from './modules/production/production.controller.js';
import { transfersRouter } from './modules/transfers/transfers.controller.js';

export const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Serve uploaded identification PDFs and avatars statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'habesha-bakery-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Foundation Routes
app.use('/api/company', companyRouter);
app.use('/api/auth', authRouter);
app.use('/api/branches', branchesRouter);
app.use('/api/users', usersRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/production', productionRouter);
app.use('/api/transfers', transfersRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});
