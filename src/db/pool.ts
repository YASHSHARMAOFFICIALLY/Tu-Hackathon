/**
 * Transactional database client (WebSocket pool).
 *
 * The default client in ./client.ts speaks HTTP, which cannot do interactive
 * transactions. This one opens a real Postgres session over a WebSocket, so
 * `dbPool.transaction(...)` works.
 *
 * Use it ONLY for writes that must be all-or-nothing — right now that means
 * Better Auth's sign-up, which inserts into `user` and `account` and would
 * otherwise be able to leave a user with no linked provider (a permanent
 * lockout: they cannot sign in, and cannot sign up again because the email is
 * already taken). Everything else should keep using `db` from ./client.ts,
 * which has no connection to set up and is cheaper per query.
 *
 * ponytail: one shared pool at module scope. Serverless runtimes reuse it
 * across warm invocations; add explicit lifecycle handling only if Neon starts
 * reporting connection exhaustion.
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import { env } from "@/env";
import { relations } from "./relations";

// Node has had a global WebSocket since v22; older runtimes need the `ws`
// package injected here instead.
neonConfig.webSocketConstructor ??= globalThis.WebSocket;

const pool = new Pool({ connectionString: env.DATABASE_URL });

export const dbPool = drizzle({ client: pool, relations });
