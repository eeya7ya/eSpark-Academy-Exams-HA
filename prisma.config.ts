import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` runs at build time where no database is needed, so the
// URL falls back to a placeholder. `prisma db push` (npm run db:push) needs
// a real DATABASE_URL_UNPOOLED (direct, non-pooled connection) in .env.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.POSTGRES_URL ??
      "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
