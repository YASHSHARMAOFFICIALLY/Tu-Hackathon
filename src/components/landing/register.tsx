import Link from "next/link";

import { cn } from "@/lib/utils";

import { IssueCards } from "@/components/issues/issue-cards";
import { getRegisterSnapshot } from "@/modules/issues/public-stats";

/**
 * The register, as it actually stands.
 *
 * The section above this one describes what the product does. This one shows
 * it: three counts read out of the database and the three most recently filed
 * reports, rendered with the same card the register itself uses, so the landing
 * page cannot drift away from `/issues`.
 *
 * Composition is deliberately not the bento's (§ centred title over a tinted
 * grid): the heading sits left with the link on its baseline, and the figures
 * are a hairline-divided row rather than four stat cards, which is the shape
 * every generated dashboard already has.
 *
 * The section sits on the page's own white, like every other one. It used to
 * have a `--surface` plate of its own; against the white sections either side
 * that read as a panel someone forgot to finish rather than as a deliberate
 * band, so the page now changes ground exactly once, at the ink panel above.
 *
 * Every number here is a count from the register. None is a claim, a target or
 * a rounded-up figure, and the caption says when it was read.
 */

/** Pinned locale so the server-rendered figure is stable across machines. */
const fmt = (n: number) => n.toLocaleString("en-GB");

const LINK =
  "text-brand inline-flex h-11 items-center gap-1.5 rounded-lg text-[0.9375rem] font-medium underline decoration-current/30 underline-offset-4 transition-colors hover:decoration-current focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none";

function Band({ children }: { children: React.ReactNode }) {
  return (
    <section
      id="register"
      className="scroll-mt-32 py-20 md:py-24"
    >
      <div className="mx-auto max-w-6xl px-5 md:px-8">{children}</div>
    </section>
  );
}

export async function Register() {
  const snapshot = await getRegisterSnapshot();

  // Two failure shapes, one fallback: the database was unreachable when the
  // page was built, or it was reachable and empty. Neither invents a number,
  // and both still hand the visitor the next action.
  if (!snapshot || snapshot.total === 0) {
    return (
      <Band>
        <h2 className="text-ink max-w-[22ch] text-[clamp(1.875rem,3.2vw,2.75rem)] leading-[1.1] font-bold tracking-[-0.03em] text-balance">
          The register is open
        </h2>
        <p className="text-body mt-4 max-w-[54ch] text-[1.0625rem] leading-[1.6] text-pretty">
          {snapshot
            ? "No reports have been filed yet. The first one appears here, with its reference number, the moment it is submitted."
            : "The live counts could not be read just now. The register itself is still there."}
        </p>
        <Link href="/issues" className={`${LINK} mt-6`}>
          Open the register
        </Link>
      </Band>
    );
  }

  const FIGURES = [
    { value: snapshot.open, label: "Reports open" },
    { value: snapshot.resolved, label: "Marked resolved" },
    { value: snapshot.departments, label: "Departments taking reports" },
  ];

  return (
    <Band>
      {/* The link belongs on the heading's baseline, not the paragraph's. It
          used to sit at the bottom of a block whose second element is two lines
          of body copy, which left it stranded in the white space to the right
          of nothing. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <h2 className="text-ink max-w-[20ch] text-[clamp(1.875rem,3.2vw,2.75rem)] leading-[1.1] font-bold tracking-[-0.03em] text-balance">
          {fmt(snapshot.total)} reports on the register
        </h2>
        <Link href="/issues" className={LINK}>
          Open the register
        </Link>
      </div>
      <p className="text-body mt-4 max-w-[54ch] text-[1.0625rem] leading-[1.6] text-pretty">
        Counted in the register itself, not quoted at you. Every one of them is
        open to read, with its status and the history behind it.
      </p>

      {/* Figures, not cards. A hairline between them is enough separation, and
          the mono numerals are the same treatment reference numbers get. They
          sit on the band's own ground: a white panel here was a third surface
          on a page that has two, and boxing three numbers turned them back into
          the stat cards this section exists to avoid. */}
      <dl className="divide-line mt-10 grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {FIGURES.map((figure, i) => (
          <div key={figure.label} className={cn("py-7", i === 0 ? "sm:pr-6" : "px-6")}>
            <dd className="text-ink font-mono text-[2rem] leading-none font-bold tabular-nums">
              {fmt(figure.value)}
            </dd>
            <dt className="text-body mt-2.5 text-[0.875rem] leading-[1.5]">
              {figure.label}
            </dt>
          </div>
        ))}
      </dl>

      <h3 className="text-ink mt-12 text-[1.0625rem] font-semibold tracking-[-0.01em]">
        Filed most recently
      </h3>
      <IssueCards
        className="mt-4"
        issues={snapshot.recent}
        empty="Nothing filed yet."
      />
    </Band>
  );
}

export default Register;
