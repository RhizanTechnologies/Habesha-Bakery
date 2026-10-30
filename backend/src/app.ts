import express from 'express';
import cors from 'cors';
import path from 'path';
import { authRouter } from './modules/auth/auth.controller.js';
import { branchesRouter } from './modules/branches/branches.controller.js';
import { usersRouter } from './modules/users/users.controller.js';
import { companyRouter } from './modules/company/company.controller.js';
import { productsRouter } from './modules/products/products.controller.js';
import { posRouter } from './modules/pos/pos.controller.js';
import { dailyTrackingRouter } from './modules/daily-tracking/daily-tracking.controller.js';

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

// Developer 2: Front-of-House (Products, POS Touchscreen & Daily Cash Tracking)
app.use('/api/products', productsRouter);
app.use('/api/pos', posRouter);
app.use('/api/daily-tracking', dailyTrackingRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});
