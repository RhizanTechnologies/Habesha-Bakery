import 'dotenv/config';
import { app } from './app.js';

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Habesha Bakery API Server running on http://0.0.0.0:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
});
