/**
 * Schema barrel — the single object the Drizzle client and drizzle-kit are
 * built from.
 *
 * Tables live with the module that owns them (`src/modules/<feature>/schema/`),
 * not in this directory. This file only re-exports them, plus the shared
 * primitives that belong to no single module (enums, column helpers).
 *
 * Three rules keep this scaling with contributors:
 *   1. A new table means a NEW FILE inside its module — never an append to
 *      someone else's file. That is what keeps schema PRs conflict-free.
 *   2. Every new file must be re-exported below, or drizzle-kit will not see
 *      the table and the migration will silently miss it.
 *   3. Schema files import only drizzle and other schema files. Never a
 *      service — that would create a cycle through the db client.
 */
export * from "./enums";
export * from "@/modules/auth/schema/auth";
export * from "@/modules/auth/schema/profiles";
export * from "@/modules/departments/schema/departments";
export * from "@/modules/issues/schema/issues";
export * from "@/modules/issues/schema/issue-history";
export * from "@/modules/issues/schema/comments";
export * from "@/modules/issues/schema/attachments";
export * from "@/modules/issues/schema/issue-duplicates";
