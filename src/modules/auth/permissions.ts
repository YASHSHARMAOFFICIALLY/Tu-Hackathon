/**
 * Role-based authorization.
 *
 * Every check goes through here so there is one definition of "may they?" in
 * the codebase. Hiding a button in the UI is not authorization — these run on
 * the server, in the service layer, on every protected action.
 */
import { eq } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import type { UserRole } from "@/db/schema";

import { getSession } from "./session";

/** Thrown when a signed-in user lacks the required role. Routes map it to 403. */
export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Thrown when there is no session at all. Routes map it to 401. */
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: UserRole;
  displayName: string | null;
};

/**
 * The signed-in user with their role, or null.
 *
 * Cached per request like `getSession`, so a page that checks permissions in
 * three places still costs one session lookup and one profile query.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;

  const [profile] = await db
    .select({ role: profiles.role, displayName: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.userId, session.user.id))
    .limit(1);

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
    // A missing profile row means the sign-up hook did not run. Fall back to the
    // least privileged role rather than assuming — never fail open.
    role: profile?.role ?? "CITIZEN",
    displayName: profile?.displayName ?? null,
  };
});

/**
 * Pure predicate — no database, no session. Kept separate so the permission
 * matrix can be tested exhaustively without seeding users.
 */
export function hasRole(role: UserRole, allowed: readonly UserRole[]): boolean {
  return allowed.includes(role);
}

/**
 * Assert the caller holds one of `allowed`, and return them.
 *
 * Throws rather than redirecting: services must not know about HTTP or
 * navigation. Route handlers translate these to 401/403.
 */
export async function requireRole(
  ...allowed: readonly UserRole[]
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  if (!hasRole(user.role, allowed)) {
    throw new ForbiddenError(
      `Requires role ${allowed.join(" or ")}; you are ${user.role}.`,
    );
  }
  return user;
}

/** Shorthands for the two checks used most. */
export const requireAdmin = () => requireRole("ADMIN");
export const requireOfficer = () => requireRole("OFFICER", "ADMIN");
