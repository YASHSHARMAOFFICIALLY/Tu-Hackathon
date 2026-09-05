/**
 * Coarse route protection: bounces anonymous visitors off protected routes
 * before any page code runs.
 *
 * IMPORTANT — this is a redirect for UX, NOT an authorization boundary. It only
 * checks that a session cookie is PRESENT; it does not validate it, because
 * middleware runs on every matched request and a database lookup here would tax
 * the whole app. A forged cookie gets past this and is then rejected by
 * `requireSession()` in the page itself.
 *
 * Rule for contributors: every protected page still calls `requireSession()`.
 * Middleware is the fast path, not the lock.
 */
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const signIn = new URL("/sign-in", request.url);
    // Preserve where they were headed so sign-in can send them back.
    signIn.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(signIn);
  }
  return NextResponse.next();
}

export const config = {
  // Add protected route prefixes here. Everything not listed stays public.
  matcher: ["/admin/:path*", "/dashboard/:path*", "/settings/:path*"],
};
