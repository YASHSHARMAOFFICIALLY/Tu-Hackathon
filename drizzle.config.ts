import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit configuration (migration tooling only — the runtime client lives
 * in src/db/client.ts).
 *
 * `schema` points at the barrel, not a glob, deliberately: drizzle-kit and the
 * runtime client then read the exact same set of tables. A glob would let a
 * table that someone forgot to re-export still land in a migration, so the
 * database and the TypeScript types would drift apart.
 *
 * This file is loaded by the drizzle-kit CLI outside of Next.js, so it reads
 * process.env directly rather than importing src/env.ts (no `@/` alias here).
 * `bun run` loads .env.local before the CLI starts.
 */
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "Missing DATABASE_URL. Copy .env.example to .env.local and fill it in.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: { url },
});
