"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { signIn, signUp } from "@/modules/auth/client";

/**
 * Email and password sign-in, with account creation on the same form.
 *
 * Both branches are wired to Better Auth's credential provider, which is
 * enabled in src/modules/auth/index.ts. Creating an account is offered here
 * because a sign-in form for a provider nobody can register with is a dead end.
 *
 * The server owns the real rules; this validates only enough to avoid a
 * pointless round trip, and renders whatever the server rejects.
 */
export function CredentialsForm({
  callbackURL,
  mode,
  onModeChange,
}: {
  callbackURL: string;
  mode: "signIn" | "signUp";
  onModeChange: (mode: "signIn" | "signUp") => void;
}) {
  const router = useRouter();
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const creating = mode === "signUp";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (creating && name.trim().length < 2) {
      setError("Enter the name you want shown on your reports.");
      return;
    }
    if (password.length < 8) {
      setError("Passwords are at least 8 characters.");
      return;
    }

    setPending(true);
    const result = creating
      ? await signUp.email({ name: name.trim(), email, password, callbackURL })
      : await signIn.email({ email, password, callbackURL });
    setPending(false);

    if (result.error) {
      setError(result.error.message ?? "That did not work. Try again.");
      return;
    }
    router.push(callbackURL);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {creating ? (
        <Field
          id={nameId}
          label="Full name"
          type="text"
          autoComplete="name"
          placeholder="Priya Sharma"
          value={name}
          onChange={setName}
        />
      ) : null}

      <Field
        id={emailId}
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={setEmail}
      />

      <Field
        id={passwordId}
        label="Password"
        type="password"
        autoComplete={creating ? "new-password" : "current-password"}
        placeholder={creating ? "At least 8 characters" : "Your password"}
        value={password}
        onChange={setPassword}
        describedBy={error ? errorId : undefined}
      />

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-[0.8125rem] text-red-800"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="bg-brand hover:bg-brand-hover flex h-12 w-full items-center justify-center rounded-xl text-[0.9375rem] font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
      >
        {pending
          ? creating
            ? "Creating your account…"
            : "Signing you in…"
          : creating
            ? "Create account"
            : "Sign in"}
      </button>

      <p className="text-body text-center text-[0.875rem]">
        {creating ? "Already registered?" : "No account yet?"}{" "}
        <button
          type="button"
          onClick={() => {
            onModeChange(creating ? "signIn" : "signUp");
            setError(null);
          }}
          className="text-brand rounded-sm font-medium underline decoration-current/30 underline-offset-4 transition-colors hover:decoration-current focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          {creating ? "Sign in instead" : "Create one"}
        </button>
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  type,
  autoComplete,
  placeholder,
  value,
  onChange,
  describedBy,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  describedBy?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-ink block text-[0.875rem] font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={describedBy}
        className="border-line text-ink placeholder:text-body/55 focus-visible:border-brand focus-visible:ring-brand/25 mt-1.5 h-12 w-full rounded-xl border bg-white px-3.5 text-[0.9375rem] transition-colors focus-visible:ring-2 focus-visible:outline-none"
      />
    </div>
  );
}
