import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CRITICAL CONFIGURATION ERROR: DATABASE_URL is not configured in production environment."
    );
  }
  process.env.DATABASE_URL =
    "postgresql://postgres:postgres@localhost:5432/outreachos?schema=public";
}

/**
 * Serverless PrismaClient Lifecycle Management:
 *
 * In serverless execution environments (e.g. Vercel Serverless Functions / AWS Lambda),
 * function containers can remain warm across sequential requests. Storing the PrismaClient
 * instance on `globalThis` avoids instantiating redundant database connection pools per invocation.
 *
 * Connection Pooling Architecture:
 * - DATABASE_URL: Point to a managed PostgreSQL connection pooler (e.g., PgBouncer, Supabase Pooler, Neon Pooler).
 *   Recommended URL parameters for serverless scale:
 *   `?schema=public&connection_limit=5&pool_timeout=10&connect_timeout=5`
 *   - `connection_limit`: Restricts maximum connections opened by a single serverless container (prevents pool exhaustion).
 *   - `pool_timeout`: Seconds to wait for a connection from the internal pool before failing fast (default 10s).
 *   - `connect_timeout`: Seconds to wait when establishing a new TCP connection (default 5s).
 * - DIRECT_URL: Point to the direct, non-pooled connection on port 5432 for Prisma CLI migrations
 *   (`prisma migrate deploy` / `prisma migrate dev`) which require session-level locks that transaction poolers
 *   (like PgBouncer in transaction mode) do not support.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

// Retain client on globalThis across HMR cycles in dev and across warm container invocations in serverless production
globalForPrisma.prisma = prisma;

/**
 * Validates whether the PostgreSQL database is reachable and active.
 */
export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  error?: string;
}> {
  try {
    // Quick query to test connection
    await prisma.$queryRaw`SELECT 1`;
    return { connected: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      error: message.includes("Can't reach database server")
        ? "PostgreSQL database is unreachable. Ensure your PostgreSQL server or Docker container ('docker compose up -d') is running."
        : message,
    };
  }
}
