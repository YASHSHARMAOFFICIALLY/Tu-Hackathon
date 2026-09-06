import Link from "next/link";
import { redirect } from "next/navigation";

import { BackupConsole } from "@/components/admin/backup-console";
import { PageShell } from "@/components/app/page-shell";
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
 * It lives inside the ordinary application shell. The bespoke dark header this
 * page used to carry was a second navigation for two screens, and it cost the
 * rail, the search box and the way back to the register on the one screen where
 * an operator most wants to check something before overwriting a database.
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
    <PageShell title="Backup and restore">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-ink text-[clamp(1.5rem,2.4vw,2rem)] leading-[1.1] font-bold tracking-[-0.03em]">
          Backup and restore
        </h1>
        <p className="text-body mt-2 max-w-[64ch] text-[0.9375rem] leading-[1.55] text-pretty">
          Take a copy of the register, check a copy before you trust it, and put
          one back. A restore runs in a single transaction: if any row fails,
          nothing is written and the register is exactly as it was.
        </p>

        <BackupConsole />
      </div>
    </PageShell>
  );
}
