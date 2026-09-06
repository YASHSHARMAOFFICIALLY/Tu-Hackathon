import Link from "next/link";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/app/page-shell";
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
 * Server-gated on ADMIN here and enforced again in `listPeople`/`setPersonRole`.
 *
 * It lives inside the ordinary application shell rather than behind a bespoke
 * admin header. The separate header was a second navigation for two pages: it
 * cost the rail, the search box and the way back to the register, and it made
 * administration feel like a different product. Administration is part of this
 * one, so it gets the same frame as everything else.
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
    <PageShell title="People and roles">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-ink text-[clamp(1.5rem,2.4vw,2rem)] leading-[1.1] font-bold tracking-[-0.03em]">
          People and roles
        </h1>
        <p className="text-body mt-2 max-w-[64ch] text-[0.9375rem] leading-[1.55] text-pretty">
          Everyone who has signed in, and what they are allowed to do. Promoting
          a resident to officer is how the queue gets worked: an officer sees
          their department&apos;s issues and every issue nobody has triaged yet.
        </p>

        <PeopleConsole
          initialPeople={people}
          departments={departments}
          currentUserId={user.id}
        />
      </div>
    </PageShell>
  );
}

