/**
 * Coarse route protection: bounces anonymous visitors off protected routes
 * before any page code runs.
 *
 * This is a redirect for UX, not an authorization boundary. It only checks
 * that a session cookie is present. Every protected page still validates the
 * session and role before reading or changing private data.
 */
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(signIn);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/settings/:path*"],
};
