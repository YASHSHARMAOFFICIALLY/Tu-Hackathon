/**
 * Server-side session helpers.
 *
 * Import these instead of calling `auth.api.getSession` directly — the caching
 * below only works if every caller goes through the same function.
 */
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth, type Session } from "./index";

/**
 * The current session, or null.
 *
 * Wrapped in React's `cache()`, which deduplicates per request: a page with a
 * header, a sidebar and a body all asking "who is signed in?" issues ONE
 * database query, not three. Without this each Server Component pays a full
 * round-trip to Neon.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  return auth.api.getSession({ headers: await headers() });
});

/**
 * The current session, or a redirect to sign-in.
 *
 * Use this at the top of every page and Server Action that must not run for an
 * anonymous visitor. It returns a non-null session, so callers get a typed
 * `session.user` with no null checks and no chance of forgetting one.
 *
 * `redirect()` throws, which is why the return type is honest about never
 * being null.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}
