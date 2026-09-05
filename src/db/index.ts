/**
 * Public surface of the database layer.
 *
 * Application code imports from `@/db` and nothing deeper — that indirection is
 * what lets the client or schema layout change without touching call sites.
 */
export { db, type Database } from "./client";
export * as schema from "./schema";
