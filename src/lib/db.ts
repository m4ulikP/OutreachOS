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

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

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
