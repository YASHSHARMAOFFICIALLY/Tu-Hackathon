"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

/**
 * Reference-number lookup.
 *
 * Every report gets a sequential `number` at submission, and it is the only
 * thing a citizen needs to follow their issue: no account, no email. Putting
 * that lookup in the hero states what the product is faster than a paragraph.
 *
 * ponytail: validates client-side only and navigates; /track/:number does the
 * real fetch and owns the "no such report" state.
 */
export function TrackLookup() {
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim().replace(/^#/, "");
    if (!/^\d+$/.test(trimmed)) {
      setError("Reference numbers are digits only, like 1042.");
      return;
    }
    setError(null);
    router.push(`/track/${trimmed}`);
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor={inputId} className="text-body block text-[0.8125rem]">
        Already have a reference number?
      </label>

      <div className="mt-2.5 flex gap-2">
        <div className="relative flex-1">
          <span
            aria-hidden="true"
            className="text-body/60 pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-mono text-sm"
          >
            #
          </span>
          <input
            id={inputId}
            name="number"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="1042"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={`text-ink placeholder:text-body/60 h-12 w-full rounded-xl border bg-white/85 pr-4 pl-8 text-center font-mono text-sm backdrop-blur-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${
              error
                ? "border-red-600 focus-visible:ring-red-600/30"
                : "border-line focus-visible:border-brand focus-visible:ring-brand/25"
            }`}
          />
        </div>
        <button
          type="submit"
          className="bg-ink hover:bg-brand inline-flex h-12 shrink-0 items-center rounded-xl px-5 text-[0.9375rem] font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Track it
        </button>
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-2 text-[0.8125rem] text-red-700"
        >
          {error}
        </p>
      ) : null}
    </form>
  );
}
