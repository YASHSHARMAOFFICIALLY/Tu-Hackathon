"use client";

import { useState } from "react";

import { CredentialsForm } from "./credentials-form";
import { GoogleSignInButton } from "./google-sign-in-button";

/**
 * Owns the sign-in / create-account mode so the heading and the submit button
 * always agree. Google sits above the credential fields because it is the path
 * most people take.
 */
export function AuthPanel({ callbackURL }: { callbackURL: string }) {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");

  return (
    <>
      <h1 className="text-ink mt-10 text-[2rem] leading-[1.1] font-bold tracking-[-0.03em]">
        {mode === "signUp" ? "Create account" : "Sign in"}
      </h1>

      <div className="mt-8">
        <GoogleSignInButton callbackURL={callbackURL} />
      </div>

      <div className="my-7 flex items-center gap-4">
        <span className="bg-line h-px flex-1" />
        <span className="text-body text-[0.75rem] tracking-wide uppercase">
          or with email
        </span>
        <span className="bg-line h-px flex-1" />
      </div>

      <CredentialsForm
        callbackURL={callbackURL}
        mode={mode}
        onModeChange={setMode}
      />
    </>
  );
}
