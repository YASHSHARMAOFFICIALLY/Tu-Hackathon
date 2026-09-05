/**
 * The Drizzle database client.
 *
 * Driver: `neon-http` — each query is a single HTTPS round-trip to Neon's SQL
 * endpoint. No connection pool to manage, no cold-start handshake, works in
 * every runtime including the edge.
 *
 * Known ceiling: the HTTP driver has NO interactive transactions.
 * `db.transaction(...)` throws. For several statements that must succeed or
 * fail together, use `db.batch([q1, q2])`, which Neon runs in one transaction.
 * If a flow genuinely needs read-then-conditionally-write atomicity, add a
 * second client on `drizzle-orm/neon-serverless` (WebSocket Pool) rather than
 * changing this one — the rest of the app keeps the cheap path.
 */
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "@/env";
import { relations } from "./relations";

export const db = drizzle(env.DATABASE_URL, { relations });

/** The concrete client type, for helpers that accept a db handle. */
export type Database = typeof db;
