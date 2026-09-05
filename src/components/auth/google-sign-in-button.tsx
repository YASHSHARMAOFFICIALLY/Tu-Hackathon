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
      className="border-field text-ink hover:bg-brand-tint/50 flex h-12 w-full items-center justify-center gap-3 rounded-xl border bg-white text-[0.9375rem] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
      onClick={async () => {
        setPending(true);
        await signIn.social({ provider: "google", callbackURL });
      }}
    >
      {pending ? null : <GoogleMark />}
      {pending ? "Redirecting…" : "Continue with Google"}
    </button>
  );
}

/** Google's own mark, in its own colours; a monochrome version is off-brand for them. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-[1.125rem] shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}
