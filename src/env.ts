/**
 * Validated server-side environment access.
 *
 * Import this instead of touching `process.env` directly: a missing or
 * malformed variable fails loudly at startup here, rather than as a confusing
 * driver error deep inside a request handler.
 *
 * Server-only by convention: never import this from a Client Component, it
 * would leak secrets into the browser bundle. (Kept free of the `server-only`
 * package so the standalone migrate script and drizzle.config.ts can reuse it.)
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

// ponytail: hand-rolled instead of zod/t3-env — one rule, one dependency saved.
// Swap in a schema library when this grows past ~5 variables or needs coercion.
export const env = {
  DATABASE_URL: required("DATABASE_URL"),

  /** Signs session cookies. Rotating it logs every user out. */
  BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET"),
  /** Public origin of this app; must match the Google redirect URI's origin. */
  BETTER_AUTH_URL: required("BETTER_AUTH_URL"),

  GOOGLE_CLIENT_ID: required("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: required("GOOGLE_CLIENT_SECRET"),

  /**
   * Gemini API key (Google AI Studio). OPTIONAL on purpose: without it the app
   * runs exactly as before, minus AI suggestions. Triage must never be the
   * reason a citizen cannot file a report.
   */
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
  /** Model ids in env so a newer model is a config change, not a code change. */
  GEMINI_MODEL: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  GEMINI_EMBEDDING_MODEL:
    process.env.GEMINI_EMBEDDING_MODEL ?? "text-embedding-004",

  /**
   * Vercel Blob read-write token, injected by Vercel once the store is linked
   * to the project. OPTIONAL for the same reason as the Gemini key: a missing
   * token must degrade to "photos cannot be attached", never to a report that
   * cannot be filed. Evidence is valuable; the report is essential.
   */
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ?? "",
} as const;

/** Whether AI features are configured. Everything AI checks this first. */
export const aiEnabled = env.GEMINI_API_KEY.length > 0;

/** Whether photo evidence can be stored. The upload route checks this first. */
export const uploadsEnabled = env.BLOB_READ_WRITE_TOKEN.length > 0;
