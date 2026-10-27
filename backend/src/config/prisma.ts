import { PrismaClient } from '@prisma/client';

function getDatabaseUrl(): string | undefined {
  let url = process.env.DATABASE_URL?.trim();
  if (!url) return undefined;

  // Strip wrapping double or single quotes if present
  url = url.replace(/^["']|["']$/g, '').trim();

  // PgBouncer pooler requires pgbouncer=true to disable prepared statements
  if ((url.includes(':6543') || url.includes('pooler')) && !url.includes('pgbouncer=')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}pgbouncer=true`;
  }

  if (!url.includes('connect_timeout=')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}connect_timeout=30`;
  }

  if (!url.includes('pool_timeout=')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}pool_timeout=30`;
  }

  return url;
}

const dbUrl = getDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: dbUrl
      ? {
          db: {
            url: dbUrl,
          },
        }
      : undefined,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
