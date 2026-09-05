"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PinIcon } from "@/components/app/icons";
import { CATEGORY } from "@/components/dashboard/pieces";
import type { IssueCategory } from "@/db/schema/enums";
import { cn } from "@/lib/utils";

/**
 * The report form, in two steps.
 *
 * The brief requires possible duplicates to be shown BEFORE a report is
 * created, so "Continue" is not "submit": it posts the draft to
 * `/api/issues/check-duplicates`, and only a second, deliberate press files
 * anything. When a citizen files anyway, the match they saw travels with the
 * report as `possibleDuplicateOf`, which is what lets an officer merge the two
 * later instead of guessing.
 *
 * With no matches the confirm step is skipped — a second click that always says
 * "nothing found" trains people to click through the one that matters.
 *
 * Client-side validation mirrors `createIssueSchema` for the error message
 * only. The server parses the same input again; this is courtesy, not a check.
 */
type Candidate = {
  id: string;
  number: number;
  title: string;
  status: string;
  address: string;
  similarity: number;
  matchedBy?: string;
};

type Draft = {
  title: string;
  description: string;
  category: IssueCategory;
  address: string;
  latitude?: number;
  longitude?: number;
};

const FIELD =
  "border-field text-ink placeholder:text-placeholder w-full rounded-xl border bg-white px-3.5 py-3 text-[0.9375rem] focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand focus-visible:outline-none";

export function ReportForm() {
  const router = useRouter();

  const [draft, setDraft] = useState<Draft>({
    title: "",
    description: "",
    category: "ROADS",
    address: "",
  });
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [busy, setBusy] = useState<"checking" | "filing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const invalid =
    draft.title.trim().length < 5 ||
    draft.description.trim().length < 10 ||
    draft.address.trim().length < 3;

  async function check(event: React.FormEvent) {
    event.preventDefault();
    if (invalid || busy) return;

    setBusy("checking");
    setError(null);

    try {
      const response = await fetch("/api/issues/check-duplicates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          category: draft.category,
          latitude: draft.latitude,
          longitude: draft.longitude,
        }),
      });

      const body = await response.json();
      const found: Candidate[] = response.ok ? (body.candidates ?? []) : [];

      // A failed duplicate check must not block a citizen reporting a hazard:
      // it degrades to "no matches", which is what the pre-AI behaviour was.
      if (found.length === 0) {
        await file();
        return;
      }
      setCandidates(found);
    } catch {
      await file();
    } finally {
      setBusy(null);
    }
  }

  async function file(duplicateOf?: string) {
    setBusy("filing");
    setError(null);

    try {
      const response = await fetch("/api/issues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...draft,
          title: draft.title.trim(),
          description: draft.description.trim(),
          address: draft.address.trim(),
          ...(duplicateOf ? { possibleDuplicateOf: duplicateOf } : {}),
        }),
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          response.status === 401
            ? "Your session has expired. Sign in again and the form will still be here."
            : (body.error ?? "The report could not be filed. Try again."),
        );
        setBusy(null);
        return;
      }

      router.push(`/report/filed?number=${body.number}&id=${body.id}`);
    } catch {
      setError("No connection to the server. Check your network and try again.");
      setBusy(null);
    }
  }

  function locate() {
    if (!navigator.geolocation) {
      setError("This browser cannot share a location. Type the address instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDraft((d) => ({
          ...d,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError(
          "Location was refused. The address alone is enough — the coordinates only sharpen the duplicate check.",
        );
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  /* ── Step two ─────────────────────────────────────────────── */

  if (candidates) {
    return (
      <section className="border-line rounded-2xl border bg-white p-6 md:p-8">
        <div className="bg-status-acknowledged-tint rounded-xl p-4">
          <p className="text-status-acknowledged text-[0.9375rem] leading-[1.6] font-medium">
            {candidates.length === 1
              ? "One existing report looks like this one."
              : `${candidates.length} existing reports look like this one.`}
          </p>
          <p className="text-body mt-1 text-[0.875rem] leading-[1.6]">
            Adding your voice to an existing report gets it seen faster than a
            second copy of it. Open one to check before you file.
          </p>
        </div>

        <ul className="divide-line mt-5 divide-y">
          {candidates.map((candidate) => (
            <li key={candidate.id} className="flex items-start gap-4 py-3.5">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/issues/${candidate.id}`}
                  className="text-ink hover:text-brand text-[0.9375rem] font-medium underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                >
                  {candidate.title}
                </Link>
                <p className="text-body mt-0.5 truncate text-[0.8125rem]">
                  #{candidate.number} · {candidate.address}
                </p>
              </div>
              <button
                type="button"
                onClick={() => file(candidate.id)}
                disabled={busy !== null}
                className="border-field text-ink hover:bg-canvas h-10 shrink-0 rounded-lg border px-3.5 text-[0.8125rem] font-medium transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                Mine is this one
              </button>
            </li>
          ))}
        </ul>

        {error ? <Error>{error}</Error> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => file()}
            disabled={busy !== null}
            className="bg-brand hover:bg-brand-hover h-12 rounded-xl px-6 text-[0.9375rem] font-medium text-white transition-colors disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {busy === "filing" ? "Filing…" : "None of these — file mine"}
          </button>
          <button
            type="button"
            onClick={() => setCandidates(null)}
            disabled={busy !== null}
            className="text-body hover:text-ink h-12 rounded-xl px-4 text-[0.9375rem] transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          >
            Back to my report
          </button>
        </div>
      </section>
    );
  }

  /* ── Step one ─────────────────────────────────────────────── */

  return (
    <form
      onSubmit={check}
      className="border-line rounded-2xl border bg-white p-6 md:p-8"
    >
      <div className="grid gap-5">
        <Field
          label="What is the problem?"
          hint="A short line an officer can scan. At least 5 characters."
        >
          <input
            required
            minLength={5}
            maxLength={200}
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Streetlight out on the market road"
            className={FIELD}
            autoComplete="off"
          />
        </Field>

        <Field label="Category">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY) as IssueCategory[]).map((key) => {
              const active = draft.category === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => set("category", key)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-[0.875rem] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none",
                    active
                      ? "border-brand bg-brand-tint text-brand"
                      : "border-field text-body hover:bg-surface",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full"
                    style={{ background: CATEGORY[key].color }}
                  />
                  {CATEGORY[key].label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field
          label="Where is it?"
          hint="A landmark and a road is enough. Coordinates are optional and are rounded before anyone else sees them."
        >
          <div className="flex flex-wrap gap-2">
            <input
              required
              minLength={3}
              maxLength={300}
              value={draft.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Near the bus stand, Mission Chariali"
              className={cn(FIELD, "min-w-0 flex-1")}
              autoComplete="street-address"
            />
            <button
              type="button"
              onClick={locate}
              className="border-field text-ink hover:bg-surface inline-flex h-12 shrink-0 items-center gap-2 rounded-xl border px-4 text-[0.875rem] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <PinIcon className="size-4" />
              {locating
                ? "Locating…"
                : draft.latitude
                  ? "Location added"
                  : "Use my location"}
            </button>
          </div>
        </Field>

        <Field
          label="Describe it"
          hint="What is wrong, how long it has been like that, and whether it is dangerous."
        >
          <textarea
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="The light has been out for about two weeks. The stretch is dark at night and there is no footpath."
            className={cn(FIELD, "resize-y")}
          />
          <p className="text-body mt-1.5 text-right font-mono text-[0.75rem] tabular-nums">
            {draft.description.length} / 5000
          </p>
        </Field>
      </div>

      {error ? <Error>{error}</Error> : null}

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={invalid || busy !== null}
          className="bg-brand hover:bg-brand-hover h-12 rounded-xl px-6 text-[0.9375rem] font-medium text-white transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {busy === "checking"
            ? "Checking for existing reports…"
            : busy === "filing"
              ? "Filing…"
              : "Continue"}
        </button>
        <p className="text-body text-[0.8125rem]">
          We check for existing reports of the same thing before filing.
        </p>
      </div>
    </form>
  );
}

/* ── Bits ───────────────────────────────────────────────────── */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-ink block text-[0.875rem] font-medium">{label}</span>
      {hint ? (
        <span className="text-body mt-1 mb-2 block text-[0.8125rem] leading-[1.5]">
          {hint}
        </span>
      ) : (
        <span className="mb-2 block" />
      )}
      {children}
    </label>
  );
}

function Error({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="bg-danger-tint text-danger mt-5 rounded-xl px-4 py-3 text-[0.875rem] leading-[1.55]"
    >
      {children}
    </p>
  );
}
