import Link from "next/link";
import { redirect } from "next/navigation";

import { PeopleConsole } from "@/components/admin/people-console";
import { getCurrentUser } from "@/modules/auth/permissions";
import { listPeople } from "@/modules/auth/roles";
import { listDepartments } from "@/modules/departments/service";

export const metadata = { title: "People and roles" };

/**
 * People and roles.
 *
 * The screen that makes the officer half of the product reachable. Before it,
 * `bun run db:admin` could create an administrator and nothing could create an
 * officer, so the whole triage workflow existed only behind hand-written SQL.
 *
 * Same frame as the backup console: server-gated on ADMIN here, enforced again
 * in `listPeople`/`setPersonRole`, and the dark `--ink` header that marks an
 * operations screen apart from the public pages.
 */
export default async function PeoplePage() {
  const user = await getCurrentUser();

  if (!user) redirect("/sign-in?redirectTo=/admin/people");

  const name = user.displayName ?? user.name;

  if (user.role !== "ADMIN") {
    return (
      <main className="mx-auto flex min-h-[100svh] max-w-2xl flex-col justify-center px-5 py-20 md:px-8">
        <p className="text-danger text-[0.8125rem] font-medium">
          Administrators only
        </p>
        <h1 className="text-ink mt-3 text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.05] font-bold tracking-[-0.03em]">
          This page lists every account on the register
        </h1>
        <p className="text-body mt-5 max-w-prose text-[1.0625rem] leading-[1.6]">
          You are signed in as <span className="text-ink font-medium">{name}</span>{" "}
          with the role{" "}
          <span className="text-ink font-mono text-[0.9375rem]">{user.role}</span>.
          Roles are set by administrators only: this page shows every resident&apos;s
          name and email address, and it can grant access to the whole queue.
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

  // Pages call services, not their own API routes (FRONTEND.md §5). The two
  // queries are independent, so they go together.
  const [people, departments] = await Promise.all([
    listPeople(),
    listDepartments(),
  ]);

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
          <Link
            href="/admin/people"
            aria-current="page"
            className="text-canvas rounded-lg text-[0.9375rem] focus-visible:ring-2 focus-visible:ring-canvas focus-visible:ring-offset-2 focus-visible:ring-offset-ink focus-visible:outline-none"
          >
            People
          </Link>
          <Link
            href="/admin/backup"
            className="text-ink-muted hover:text-canvas rounded-lg text-[0.9375rem] transition-colors focus-visible:ring-2 focus-visible:ring-canvas focus-visible:ring-offset-2 focus-visible:ring-offset-ink focus-visible:outline-none"
          >
            Backup
          </Link>

          <p className="text-ink-muted ml-auto hidden text-[0.8125rem] sm:block">
            {name} · <span className="font-mono">{user.role}</span>
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12 md:px-8 md:py-16">
        <h1 className="text-ink text-[clamp(1.75rem,3.2vw,2.5rem)] leading-[1.05] font-bold tracking-[-0.03em]">
          People and roles
        </h1>
        <p className="text-body mt-4 max-w-[64ch] text-[1.0625rem] leading-[1.6] text-pretty">
          Everyone who has signed in, and what they are allowed to do. Promoting
          a resident to officer is how the queue gets worked: an officer sees
          their department&apos;s issues and every issue nobody has triaged yet.
        </p>

        <PeopleConsole
          initialPeople={people}
          departments={departments}
          currentUserId={user.id}
        />
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
