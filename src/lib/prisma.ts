import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString =
    process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
  // Hosted Postgres (Neon/Supabase/Vercel) needs SSL; local dev doesn't.
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  const pool = new Pool({
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
    // Fail fast instead of hanging forever when the database is
    // unreachable or POSTGRES_URL is missing/wrong — the dashboard
    // surfaces the error instead of showing an endless loading state.
    connectionTimeoutMillis: 10_000,
  });
  const adapter = new PrismaPg(pool as any);
  return new PrismaClient({ adapter });
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export function getPrismaClient(): PrismaClient {
  return prisma;
}

// Admin-facing hint for the most common deployment problems
export function describeDbError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/does not exist|P2021|relation/i.test(message)) {
    return "Database tables are missing — run `npm run db:push` against your Neon database (see README).";
  }
  if (/reach|connect|timeout|ECONNREFUSED|ENOTFOUND|P1001|SASL|password/i.test(message)) {
    return "Cannot reach the database — check POSTGRES_URL (Neon pooled connection string) in your environment variables.";
  }
  return `Database error: ${message}`;
}
