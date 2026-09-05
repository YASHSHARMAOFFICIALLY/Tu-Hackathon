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
} as const;
