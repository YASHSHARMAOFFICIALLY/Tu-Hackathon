"use client";

import { useState } from "react";

import { signIn } from "@/auth/client";

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
      onClick={async () => {
        setPending(true);
        await signIn.social({ provider: "google", callbackURL });
      }}
    >
      {pending ? "Redirecting…" : "Continue with Google"}
    </button>
  );
}
