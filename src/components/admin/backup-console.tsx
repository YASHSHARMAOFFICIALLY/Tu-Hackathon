"use client";

import { useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * The backup console.
 *
 * Two jobs, and they are not equals. Export is one button and belongs in a
 * sidebar; restore is a sequence with an irreversible end, so it holds the
 * main column and is drawn as three numbered steps. The steps are real state,
 * not decoration: step 2 does not exist until a file is chosen, and step 3
 * does not exist until that file has passed validation, because a mode
 * selector next to a file nobody has read is a decision about nothing.
 *
 * The API paths are deliberately not printed on screen. An operator does not
 * need them, and a console that narrates its own endpoints reads like a
 * debugging page. They are in the README and in the comments here.
 *
 * Export fetches rather than linking straight at the route: a plain <a> to
 * `/api/admin/backup/export` navigates away to raw JSON whenever the request
 * fails, which is what an expired session does, and the page is lost.
 */

/** The tables in a backup, in the order the format writes them. */
const TABLES = [
  { key: "departments", label: "Departments" },
  { key: "users", label: "Users" },
  { key: "issues", label: "Issues" },
  { key: "issueHistory", label: "History" },
  { key: "comments", label: "Comments" },
  { key: "attachments", label: "Attachments" },
  { key: "issueDuplicates", label: "Duplicate links" },
] as const;

type Counts = Record<(typeof TABLES)[number]["key"], number>;

type Preview = {
  version: number;
  createdAt: string;
  counts: Counts;
  total: number;
};

type RestoreResult = {
  mode: Mode;
  restored: Counts;
  total: number;
};

type Mode = "empty-only" | "replace";

/** The word that arms a destructive restore. */
const CONFIRM_WORD = "REPLACE";

/** Every route in this module answers a failure as `{ error: string }`. */
async function errorFrom(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

/** The server sets `content-disposition: attachment; filename="..."`, readable
 *  here because the request is same-origin. */
function filenameFrom(response: Response): string {
  const match = /filename="([^"]+)"/.exec(
    response.headers.get("content-disposition") ?? "",
  );
  return match?.[1] ?? "issue-tracker-backup.json";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function BackupConsole({
  /** Row counts of the live register, so the export card states what is in the
   *  database rather than listing table names. Read on the server by the page. */
  liveCounts,
}: {
  liveCounts: Counts;
}) {
  const [redactEmails, setRedactEmails] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exported, setExported] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [mode, setMode] = useState<Mode>("empty-only");
  const [confirmText, setConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [result, setResult] = useState<RestoreResult | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const redactId = useId();
  const fileId = useId();
  const confirmId = useId();

  const armed =
    preview !== null &&
    !restoring &&
    (mode === "empty-only" || confirmText === CONFIRM_WORD);

  async function download() {
    setExporting(true);
    setExportError(null);
    setExported(null);
    try {
      const response = await fetch(
        `/api/admin/backup/export${redactEmails ? "?redactEmails=true" : ""}`,
      );
      if (!response.ok) {
        setExportError(await errorFrom(response));
        return;
      }
      const blob = await response.blob();
      const filename = filenameFrom(response);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      // Revoking in the same tick can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setExported(`${filename} · ${formatBytes(blob.size)}`);
    } catch {
      setExportError("Could not reach the server. Nothing was downloaded.");
    } finally {
      setExporting(false);
    }
  }

  async function check(chosen: File) {
    setChecking(true);
    setPreview(null);
    setPreviewError(null);
    setRestoreError(null);
    setResult(null);

    const body = new FormData();
    body.append("file", chosen);

    try {
      const response = await fetch("/api/admin/backup/preview", {
        method: "POST",
        body,
      });
      if (!response.ok) {
        setPreviewError(await errorFrom(response));
        return;
      }
      setPreview((await response.json()) as Preview);
    } catch {
      // Network-level failure: the request never reached the route, so nothing
      // was written and there is no server message to show.
      setPreviewError("Could not reach the server. Check your connection.");
    } finally {
      setChecking(false);
    }
  }

  function onFile(chosen: File | null) {
    setFile(chosen);
    setConfirmText("");
    setMode("empty-only");
    if (chosen) void check(chosen);
    else {
      setPreview(null);
      setPreviewError(null);
      setResult(null);
    }
  }

  function clearFile() {
    if (fileInput.current) fileInput.current.value = "";
    onFile(null);
  }

  async function restore() {
    if (!file || !armed) return;

    setRestoring(true);
    setRestoreError(null);
    setResult(null);

    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch(`/api/admin/backup/restore?mode=${mode}`, {
        method: "POST",
        body,
      });
      if (!response.ok) {
        setRestoreError(await errorFrom(response));
        return;
      }
      setResult((await response.json()) as RestoreResult);
      setConfirmText("");
    } catch {
      setRestoreError("Could not reach the server. Nothing was restored.");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="mt-8 grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_19rem]">
      {/* ── Restore: the main column, three steps ───────────────── */}
      <section
        aria-labelledby="restore-heading"
        className="border-line order-2 rounded-2xl border bg-white md:order-1"
      >
        <div className="border-line border-b px-6 py-5 sm:px-8">
          <h2
            id="restore-heading"
            className="text-ink text-[1.125rem] font-bold tracking-[-0.02em]"
          >
            Restore from a file
          </h2>
          <p className="text-body mt-1 text-[0.875rem] leading-[1.55]">
            Checked before anything is written, applied inside one transaction.
          </p>
        </div>

        <div className="px-6 py-7 sm:px-8">
          <Step n={1} title="Choose a backup file" done={file !== null}>
            <label htmlFor={fileId} className="sr-only">
              Backup file
            </label>
            <input
              ref={fileInput}
              id={fileId}
              type="file"
              accept="application/json,.json"
              onChange={(event) => onFile(event.target.files?.[0] ?? null)}
              className="border-field text-body file:bg-brand-tint file:text-brand block w-full cursor-pointer rounded-xl border bg-white text-[0.875rem] file:mr-4 file:cursor-pointer file:border-0 file:px-5 file:py-3 file:text-[0.875rem] file:font-medium hover:file:bg-brand-tint/70 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
            />
            {file ? (
              <p className="text-body mt-2 flex flex-wrap items-center gap-x-2 text-[0.8125rem]">
                <span className="text-ink font-mono">{file.name}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {formatBytes(file.size)}
                </span>
                <button
                  type="button"
                  onClick={clearFile}
                  className="text-brand ml-1 rounded underline decoration-current/30 underline-offset-2 hover:decoration-current focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                >
                  Remove
                </button>
              </p>
            ) : null}
          </Step>

          <Step
            n={2}
            title="What the file contains"
            done={preview !== null}
            muted={file === null}
          >
            <div aria-live="polite">
              {file === null ? (
                <p className="text-body text-[0.875rem]">
                  Nothing is read from the file until you choose one.
                </p>
              ) : null}

              {checking ? <CountsSkeleton /> : null}

              {previewError ? (
                <Callout tone="danger" title="This file cannot be restored">
                  <p>{previewError}</p>
                  <button
                    type="button"
                    onClick={clearFile}
                    className="border-field text-ink mt-4 inline-flex h-10 items-center rounded-xl border bg-white px-4 text-[0.875rem] font-medium transition-colors hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    Choose another file
                  </button>
                </Callout>
              ) : null}

              {preview ? (
                <>
                  <p className="text-body flex flex-wrap items-center gap-x-2 text-[0.8125rem]">
                    <span className="text-brand font-medium">Valid backup</span>
                    <span aria-hidden="true">·</span>
                    <span>format version</span>
                    <span className="text-ink font-mono">{preview.version}</span>
                    <span aria-hidden="true">·</span>
                    <span>taken</span>
                    <span className="text-ink font-mono">
                      {new Date(preview.createdAt).toLocaleString()}
                    </span>
                  </p>
                  <CountsTable counts={preview.counts} total={preview.total} />
                </>
              ) : null}
            </div>
          </Step>

          <Step n={3} title="Apply it" muted={preview === null} last>
            {preview === null ? (
              <p className="text-body text-[0.875rem]">
                Available once a file has passed the check.
              </p>
            ) : (
              <>
                <fieldset>
                  <legend className="sr-only">How should this file be applied?</legend>
                  <div className="flex flex-col gap-3">
                    <ModeOption
                      checked={mode === "empty-only"}
                      onChange={() => {
                        setMode("empty-only");
                        setConfirmText("");
                      }}
                      title="Into an empty database"
                      detail="Refuses if the register already holds issues. The safe default."
                    />
                    <ModeOption
                      danger
                      checked={mode === "replace"}
                      onChange={() => setMode("replace")}
                      title="Replace everything"
                      detail="Wipes the product tables, then restores, both in one transaction. Current issues, comments and history are deleted."
                    />
                  </div>
                </fieldset>

                {mode === "replace" ? (
                  <div className="border-danger/30 bg-danger-tint mt-4 rounded-xl border p-5">
                    <label
                      htmlFor={confirmId}
                      className="text-ink block text-[0.875rem] font-medium"
                    >
                      Type {CONFIRM_WORD} to confirm
                    </label>
                    <p className="text-body mt-1 max-w-[52ch] text-[0.8125rem] leading-[1.55]">
                      This deletes the current register. Export a copy first if
                      you might want it back.
                    </p>
                    <input
                      id={confirmId}
                      type="text"
                      value={confirmText}
                      onChange={(event) => setConfirmText(event.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={CONFIRM_WORD}
                      className="border-field text-ink placeholder:text-placeholder mt-3 h-11 w-full max-w-[14rem] rounded-xl border bg-white px-4 font-mono text-[0.9375rem] tracking-[0.08em] focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 focus-visible:outline-none"
                    />
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={restore}
                  disabled={!armed}
                  className={cn(
                    "mt-5 inline-flex h-12 items-center rounded-xl px-6 text-[0.9375rem] font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40",
                    mode === "replace"
                      ? "bg-danger focus-visible:ring-danger hover:opacity-90"
                      : "bg-brand hover:bg-brand-hover focus-visible:ring-brand",
                  )}
                >
                  {restoring
                    ? "Restoring…"
                    : mode === "replace"
                      ? "Replace the register"
                      : "Restore the register"}
                </button>
              </>
            )}

            <div aria-live="polite">
              {restoreError ? (
                <Callout tone="danger" title="Nothing was restored">
                  <p>{restoreError}</p>
                  <p className="mt-2">
                    The restore runs in one transaction, so a failure part way
                    through leaves the register exactly as it was.
                  </p>
                </Callout>
              ) : null}

              {result ? (
                <Callout tone="brand" title={`Restored ${result.total} rows`}>
                  <p>
                    Applied in{" "}
                    <span className="text-ink font-mono">{result.mode}</span>{" "}
                    mode.
                  </p>
                  <CountsTable counts={result.restored} total={result.total} />
                </Callout>
              ) : null}
            </div>
          </Step>
        </div>
      </section>

      {/* ── Export: one action, so it sits beside, not above ────── */}
      <section
        aria-labelledby="export-heading"
        className="border-line order-1 rounded-2xl border bg-white md:order-2 md:sticky md:top-8"
      >
        <div className="border-line border-b px-6 py-5">
          <h2
            id="export-heading"
            className="text-ink text-[1.125rem] font-bold tracking-[-0.02em]"
          >
            Export
          </h2>
          <p className="text-body mt-1 text-[0.875rem] leading-[1.55]">
            The whole register in one file.
          </p>
        </div>

        <div className="px-6 py-6">
          {/* The seven tables with their live row counts. A list of table names
              told an operator nothing they did not already know; the counts are
              the size of the thing they are about to copy, and they are the
              numbers a preview of the resulting file should match. */}
          <p className="text-body text-[0.8125rem]">
            <span className="text-ink font-mono text-[1.375rem] font-medium tabular-nums">
              {TABLES.reduce((sum, t) => sum + (liveCounts[t.key] ?? 0), 0)}
            </span>{" "}
            rows across {TABLES.length} tables
          </p>
          <ul className="mt-3 flex flex-col">
            {TABLES.map((table) => (
              <li
                key={table.key}
                className="border-line flex items-center justify-between gap-3 border-b py-1.5 text-[0.8125rem] last:border-0"
              >
                <span className="text-body">{table.label}</span>
                <span className="text-ink font-mono tabular-nums">
                  {liveCounts[table.key] ?? 0}
                </span>
              </li>
            ))}
          </ul>

          <label
            htmlFor={redactId}
            className="border-field has-checked:border-brand has-checked:bg-brand-tint/60 mt-5 flex cursor-pointer items-start gap-3 rounded-xl border bg-white p-3.5 transition-colors hover:bg-brand-tint/30"
          >
            <input
              id={redactId}
              type="checkbox"
              checked={redactEmails}
              onChange={(event) => setRedactEmails(event.target.checked)}
              className="accent-brand mt-0.5 size-4 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
            />
            <span>
              <span className="text-ink block text-[0.875rem] font-medium">
                Hide email addresses
              </span>
              <span className="text-body mt-0.5 block text-[0.75rem] leading-[1.5]">
                For a file leaving trusted hands. It still restores, but those
                users become new accounts at their next sign-in.
              </span>
            </span>
          </label>

          <button
            type="button"
            onClick={download}
            disabled={exporting}
            className="bg-brand hover:bg-brand-hover mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl px-5 text-[0.9375rem] font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          >
            {exporting ? "Preparing the file…" : "Download a backup"}
          </button>

          <div aria-live="polite">
            {exported ? (
              <p className="text-body mt-3 font-mono text-[0.75rem] break-all">
                Saved {exported}
              </p>
            ) : null}
            {exportError ? (
              <Callout tone="danger" title="The export failed">
                <p>{exportError}</p>
              </Callout>
            ) : null}
          </div>

          <p className="text-body border-line mt-6 border-t pt-4 text-[0.75rem] leading-[1.55]">
            The file holds names and email addresses. Treat it as personal data.
          </p>
        </div>
      </section>
    </div>
  );
}

/** A numbered step with a rule running down the left, so the three read as one
 *  sequence rather than three cards. */
function Step({
  n,
  title,
  children,
  done = false,
  muted = false,
  last = false,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  done?: boolean;
  muted?: boolean;
  last?: boolean;
}) {
  return (
    <div className={cn("relative pl-11", last ? "" : "border-line border-l pb-8")}>
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0 -left-[1.125rem] flex size-9 items-center justify-center rounded-full border font-mono text-[0.8125rem] font-medium transition-colors",
          done
            ? "border-brand bg-brand text-white"
            : muted
              ? "border-line bg-white text-placeholder"
              : "border-brand-line bg-brand-tint text-brand",
        )}
      >
        {n}
      </span>
      <h3
        className={cn(
          "text-[0.9375rem] leading-9 font-semibold",
          muted ? "text-placeholder" : "text-ink",
        )}
      >
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function CountsTable({ counts, total }: { counts: Counts; total: number }) {
  return (
    <table className="mt-4 w-full max-w-md text-[0.8125rem]">
      <caption className="sr-only">Rows per table</caption>
      <tbody>
        {TABLES.map((table) => (
          <tr key={table.key} className="border-line border-b last:border-0">
            <th scope="row" className="text-body py-1.5 text-left font-normal">
              {table.label}
            </th>
            <td className="text-ink py-1.5 text-right font-mono tabular-nums">
              {counts[table.key]}
            </td>
          </tr>
        ))}
        <tr className="border-ink border-t-2">
          <th scope="row" className="text-ink py-2 text-left font-medium">
            Total
          </th>
          <td className="text-ink py-2 text-right font-mono font-medium tabular-nums">
            {total}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** Shown while the file is being validated. Same shape as the table it becomes,
 *  so the panel does not jump when the counts arrive. */
function CountsSkeleton() {
  return (
    <div aria-hidden="true" className="mt-1 max-w-md">
      {TABLES.map((table) => (
        <div
          key={table.key}
          className="border-line flex items-center justify-between border-b py-1.5"
        >
          <span className="bg-line h-3 w-28 rounded motion-safe:animate-pulse" />
          <span className="bg-line h-3 w-6 rounded motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function Callout({
  tone,
  title,
  children,
}: {
  tone: "danger" | "brand";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-4 rounded-xl border p-5",
        tone === "danger"
          ? "border-danger/30 bg-danger-tint"
          : "border-brand-line bg-brand-tint",
      )}
    >
      <p
        className={cn(
          "text-[0.9375rem] font-medium",
          tone === "danger" ? "text-danger" : "text-brand",
        )}
      >
        {title}
      </p>
      <div className="text-body mt-1.5 text-[0.875rem] leading-[1.6]">
        {children}
      </div>
    </div>
  );
}

/** A radio in a card: the card is the label, so the hit target is the card
 *  rather than the 16px dot. */
function ModeOption({
  checked,
  onChange,
  title,
  detail,
  danger = false,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  detail: string;
  danger?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
        checked
          ? danger
            ? "border-danger bg-danger-tint"
            : "border-brand bg-brand-tint/60"
          : "border-field hover:bg-canvas bg-white",
      )}
    >
      <input
        type="radio"
        name="restore-mode"
        checked={checked}
        onChange={onChange}
        className={cn(
          "mt-0.5 size-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          danger
            ? "accent-danger focus-visible:ring-danger"
            : "accent-brand focus-visible:ring-brand",
        )}
      />
      <span>
        <span className="text-ink block text-[0.875rem] font-medium">{title}</span>
        <span className="text-body mt-0.5 block max-w-[52ch] text-[0.8125rem] leading-[1.55]">
          {detail}
        </span>
      </span>
    </label>
  );
}
