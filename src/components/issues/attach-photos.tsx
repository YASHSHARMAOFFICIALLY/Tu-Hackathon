"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Adding evidence to a report that already exists.
 *
 * The receipt tells a citizen whose upload failed to "open it from the register
 * and try again" — this is the control that promise refers to. It is also the
 * only way an officer attaches proof of resolution.
 *
 * On success it calls `router.refresh()` rather than pushing the new photo into
 * local state: the page is a server component, the refresh re-renders it with
 * the attachment the database now has, and there is no second copy of the truth
 * living in the browser.
 */
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

export function AttachPhotos({
  issueId,
  remaining,
}: {
  issueId: string;
  /** How many more this report may carry. Zero hides the control entirely. */
  remaining: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (remaining <= 0) return null;

  async function upload(files: FileList | null) {
    if (!files || files.length === 0 || busy) return;

    const chosen = Array.from(files).slice(0, remaining);
    const rejected = chosen.find(
      (f) => !ACCEPT.includes(f.type) || f.size > MAX_BYTES,
    );
    if (rejected) {
      setError(
        !ACCEPT.includes(rejected.type)
          ? `${rejected.name} is not a JPEG, PNG or WebP image.`
          : `${rejected.name} is larger than 8MB.`,
      );
      return;
    }

    setBusy(true);
    setError(null);

    const results = await Promise.allSettled(
      chosen.map(async (photo) => {
        const data = new FormData();
        data.append("file", photo);
        const response = await fetch(`/api/issues/${issueId}/attachments`, {
          method: "POST",
          body: data,
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? "Upload failed");
        }
      }),
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      setError(
        failed.length === chosen.length
          ? ((failed[0] as PromiseRejectedResult).reason?.message ??
            "The photo could not be uploaded.")
          : `${failed.length} of ${chosen.length} photos failed to upload.`,
      );
    }

    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-4">
      <label
        className={cn(
          "border-field bg-surface hover:bg-brand-tint flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-[0.875rem] font-medium transition-colors focus-within:ring-2 focus-within:ring-brand",
          busy && "pointer-events-none opacity-60",
        )}
      >
        <input
          type="file"
          accept={ACCEPT.join(",")}
          multiple
          disabled={busy}
          className="sr-only"
          onChange={(event) => {
            void upload(event.target.files);
            event.target.value = "";
          }}
        />
        <span className="text-brand">
          {busy
            ? "Uploading…"
            : `Add a photo${remaining > 1 ? ` (${remaining} left)` : ""}`}
        </span>
      </label>

      {error ? (
        <p
          role="alert"
          className="bg-danger-tint text-danger mt-3 rounded-xl px-4 py-3 text-[0.875rem] leading-[1.55]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
