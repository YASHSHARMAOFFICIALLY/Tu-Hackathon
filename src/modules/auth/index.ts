/**
 * Better Auth server instance — the single source of truth for sessions.
 *
 * Server-only. Client components talk to this through src/auth/client.ts,
 * which calls the HTTP routes mounted at /api/auth/*.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/db";
import { dbPool } from "@/db/pool";
import * as authSchema from "@/modules/auth/schema/auth";
import { profiles } from "@/modules/auth/schema/profiles";
import { env } from "@/env";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  // Deliberately the WebSocket pool, not the HTTP client the rest of the app
  // uses. Sign-up writes `user` and `account` in one unit of work; without a
  // real transaction a failure between them leaves a user who can never sign
  // in (no linked provider) and can never sign up again (email already taken).
  database: drizzleAdapter(dbPool, {
    provider: "pg",
    schema: authSchema,
    transaction: true,
  }),

  // Every callbackURL / redirectTo is validated against this list, so a
  // crafted ?callbackURL=https://evil.example cannot bounce a freshly signed-in
  // user (and their session cookie) off to another origin. Add production and
  // preview origins here as they appear.
  trustedOrigins: [env.BETTER_AUTH_URL],

  // Credential sign-in, alongside Google. The `account.password` column is
  // already part of Better Auth's schema, so this needs no migration, and
  // `account` is in NEVER_EXPORTED, so password hashes never reach a backup.
  //
  // Email verification is off: this deployment has no mail transport, and a
  // verification gate that can never be satisfied locks every credential user
  // out. Turn it on at the same time as a mail provider, not before.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },

  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      // Linking an incoming OAuth identity to an existing account by email is
      // only safe when the provider verifies the email it reports — otherwise
      // anyone who can create an account at a sloppy provider can claim yours.
      // Google verifies. Add a provider here only after checking that it does.
      trustedProviders: ["google"],
      // Never link when the provider reports a DIFFERENT email than the
      // existing account. That path is account takeover, not convenience.
      allowDifferentEmails: false,
    },
  },

  rateLimit: {
    // Default storage is in-memory, which is a no-op on serverless: every cold
    // start gets a fresh counter, so an attacker just rotates instances. The
    // database is the only shared state this deployment actually has.
    storage: "database",
  },

  databaseHooks: {
    user: {
      create: {
        // Every user gets exactly one profile row, created at sign-up, so no
        // downstream query has to handle "user exists but profile doesn't".
        after: async (user) => {
          await db
            .insert(profiles)
            .values({ userId: user.id, displayName: user.name })
            // Idempotent: a retried sign-up must not fail on the primary key.
            .onConflictDoNothing();
        },
      },
    },
  },

  // Must be last in the plugin list: it flushes Set-Cookie headers through
  // Next's cookie API so sign-in works from Server Actions, not just routes.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
