"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A resident's reply on a report.
 *
 * `POST /api/issues/:id/comments` has allowed CITIZEN+ since it was written, but
 * only the officer panel ever called it, so the conversation ran one way: a
 * citizen could read what the municipality said and had no way to answer, which
 * is the half of a public register that makes it a register.
 *
 * Officers do not get this control. They already have the note field in the
 * officer panel, which can also post an internal note, and two boxes on one page
 * that post to the same endpoint is a question the user should not have to
 * answer.
 *
 * On success it calls `router.refresh()` rather than appending to local state:
 * the timeline above is a server component, so the refresh re-renders it with
 * the comment and the COMMENTED history row the database now holds.
 */

/** `createCommentSchema` caps the body at 2000 characters; the counter matches. */
const MAX = 2000;

export function AddComment({ issueId }: { issueId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();

  const trimmed = body.trim();
  const tooLong = body.length > MAX;
  const ready = trimmed.length > 0 && !tooLong && !busy;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/issues/${issueId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      if (!response.ok) {
        const message = await response
          .json()
          .then((b: { error?: string }) => b.error)
          .catch(() => null);
        setError(message ?? `The update was not saved (${response.status}).`);
        return;
      }
      setBody("");
      router.refresh();
    } catch {
      setError("The update did not reach the server. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="border-line mt-5 border-t pt-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label
        htmlFor={fieldId}
        className="text-ink block text-[0.875rem] font-medium"
      >
        Add an update
      </label>
      <p className="text-body mt-1 text-[0.8125rem] leading-[1.5]">
        Anyone reading this report will see what you write, along with your name.
      </p>
      <textarea
        id={fieldId}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        placeholder="The water is back on since Tuesday morning."
        className="border-field bg-canvas text-ink placeholder:text-placeholder mt-2.5 w-full rounded-xl border px-3.5 py-2.5 text-[0.9375rem] leading-[1.6] focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
      />

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
        <p
          aria-live="polite"
          className={cn(
            "text-[0.8125rem] leading-[1.5]",
            error || tooLong ? "text-danger" : "text-body",
          )}
        >
          {error
            ? error
            : tooLong
              ? `That is ${body.length - MAX} characters too long.`
              : `${body.length} of ${MAX} characters`}
        </p>
        <button
          type="submit"
          disabled={!ready}
          className={cn(
            "h-10 shrink-0 rounded-lg px-4 text-[0.875rem] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none",
            ready
              ? "bg-brand hover:bg-brand-hover text-white"
              : "border-field text-body cursor-not-allowed border",
          )}
        >
          {busy ? "Posting…" : "Post update"}
        </button>
      </div>
    </form>
  );
}
