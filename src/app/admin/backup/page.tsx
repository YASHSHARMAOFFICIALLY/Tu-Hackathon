import Link from "next/link";
import { redirect } from "next/navigation";

import { BackupConsole } from "@/components/admin/backup-console";
import { getCurrentUser } from "@/modules/auth/permissions";

export const metadata = { title: "Backup and restore" };

/**
 * Backup and restore, the WEB-C16 screen.
 *
 * Server-gated on ADMIN. Middleware bounces anonymous visitors off `/admin/*`,
 * but that only checks a cookie is present, so the real check is here (see
 * `src/middleware.ts` for why the two are not the same thing) and the three
 * APIs enforce it a third time, which is the one that actually counts.
 *
 * The dark header is the same `--ink` plate the site footer uses. An operations
 * console needs a different frame from the public pages, and reusing a ground
 * the design system already has beats inventing an admin theme.
 */
export default async function BackupPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/sign-in?redirectTo=/admin/backup");

  const name = user.displayName ?? user.name;

  if (user.role !== "ADMIN") {
    return (
      <main className="mx-auto flex min-h-[100svh] max-w-2xl flex-col justify-center px-5 py-20 md:px-8">
        <p className="text-danger text-[0.8125rem] font-medium">
          Administrators only
        </p>
        <h1 className="text-ink mt-3 text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.05] font-bold tracking-[-0.03em]">
          This page restores the whole register
        </h1>
        <p className="text-body mt-5 max-w-prose text-[1.0625rem] leading-[1.6]">
          You are signed in as <span className="text-ink font-medium">{name}</span>{" "}
          with the role{" "}
          <span className="text-ink font-mono text-[0.9375rem]">{user.role}</span>.
          Export and restore are limited to administrators: the export contains
          every user&apos;s name and email address, and the restore can overwrite
          live data.
        </p>
        <Link
          href="/"
          className="text-brand mt-10 inline-flex h-11 w-fit items-center rounded-xl underline decoration-current/30 underline-offset-4 transition-colors hover:decoration-current focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          Back to the home page
        </Link>
      </main>
    );
  }

  return (
    <div className="flex min-h-[100svh] flex-col">
      <header className="bg-ink">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-5 md:px-8">
          <Link
            href="/"
            className="text-canvas inline-flex items-center gap-2 rounded-lg text-[0.9375rem] font-semibold tracking-[-0.01em] focus-visible:ring-2 focus-visible:ring-canvas focus-visible:ring-offset-2 focus-visible:ring-offset-ink focus-visible:outline-none"
          >
            <Shield />
            CivicTrack
          </Link>
          <span aria-hidden="true" className="text-ink-muted">
            /
          </span>
          <span className="text-ink-muted text-[0.9375rem]">Administration</span>

          <p className="text-ink-muted ml-auto hidden text-[0.8125rem] sm:block">
            {name} · <span className="font-mono">{user.role}</span>
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12 md:px-8 md:py-16">
        <h1 className="text-ink text-[clamp(1.75rem,3.2vw,2.5rem)] leading-[1.05] font-bold tracking-[-0.03em]">
          Backup and restore
        </h1>
        <p className="text-body mt-4 max-w-[64ch] text-[1.0625rem] leading-[1.6] text-pretty">
          Take a copy of the register, check a copy before you trust it, and put
          one back. A restore runs in a single transaction: if any row fails,
          nothing is written and the register is exactly as it was.
        </p>

        <BackupConsole />
      </main>
    </div>
  );
}

/** The navbar mark, reduced to the shield: at 20px the leaf inside it is mud. */
function Shield() {
  return (
    <svg viewBox="0 0 32 32" className="size-5 shrink-0" aria-hidden="true" fill="none">
      <path
        d="M16 2.5 28 7v10.2C28 24 22.8 28.6 16 30.5 9.2 28.6 4 24 4 17.2V7l12-4.5Z"
        fill="var(--color-brand-bright)"
      />
      <path
        d="m11 16 3.4 3.4L21 12.8"
        stroke="var(--color-ink)"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
