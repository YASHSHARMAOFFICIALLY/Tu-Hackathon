"use client";

import { useState } from "react";

import { signIn } from "@/modules/auth/client";

/**
 * Starts the Google OAuth flow.
 *
 * `callbackURL` is where Google returns the user after consent — it is a path
 * on this app, not the Google redirect URI (that one is fixed at
 * /api/auth/callback/google and is configured in Google Cloud Console).
 *
 * The pending state matters: the redirect takes a moment, and without it users
 * double-click and start two OAuth flows.
 */
export function GoogleSignInButton({ callbackURL = "/" }: { callbackURL?: string }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      className="min-h-11 w-full rounded-md border border-current/15 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-current/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 disabled:opacity-60"
      onClick={async () => {
        setPending(true);
        await signIn.social({ provider: "google", callbackURL });
      }}
    >
      {pending ? "Redirecting…" : "Continue with Google"}
    </button>
  );
}
