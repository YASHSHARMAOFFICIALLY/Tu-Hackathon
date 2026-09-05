/**
 * Schema barrel — the single object the Drizzle client is built with.
 *
 * One file per domain entity (users.ts, organizations.ts, subscriptions.ts...),
 * re-exported here. Two rules keep this scaling with contributors:
 *   1. A new table means a NEW FILE, never an append to someone else's — that
 *      is what keeps schema PRs free of merge conflicts.
 *   2. Every new file must be re-exported below, or drizzle-kit will not see
 *      the table and the migration will silently miss it.
 */
export * from "./auth";
export * from "./profiles";
