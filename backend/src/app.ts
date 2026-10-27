import express from 'express';
import cors from 'cors';
import { authRouter } from './modules/auth/auth.controller.js';
import { branchesRouter } from './modules/branches/branches.controller.js';
import { usersRouter } from './modules/users/users.controller.js';
import { companyRouter } from './modules/company/company.controller.js';

export const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

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

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});
