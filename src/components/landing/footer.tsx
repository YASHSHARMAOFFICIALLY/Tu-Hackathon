import Link from "next/link";

/**
 * Footer.
 *
 * The one dark plate on the page, and the only place `--ink` is used as a
 * ground rather than as type. Measured against that ground: `--canvas`
 * 14.80:1, `--ink-muted` 7.93:1, both clear of 4.5:1. `--brand-bright` is
 * 3.22:1 there and is used only as a graphic fill, never as text.
 *
 * Every href resolves to a route that exists (§0 rule 1). The section anchors
 * point at sections rendered on `/`, and they are rooted at "/" rather than
 * bare hashes so they still work if this footer is later rendered on a
 * subpage. No social links: the project has no public accounts, and an icon
 * pointing at nothing is a dead control.
 */

const SECTIONS = [
  {
    title: "Report",
    links: [
      { href: "/report", label: "Report an issue" },
      { href: "/track", label: "Track a report" },
      { href: "/issues", label: "Live issues" },
    ],
  },
  {
    title: "The system",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#faq", label: "Questions" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/sign-in", label: "Log in" },
      { href: "/sign-in", label: "Create an account" },
    ],
  },
] as const;

const LINK =
  "text-ink-muted hover:text-canvas inline-flex min-h-9 items-center rounded-md text-[0.9375rem] transition-colors focus-visible:ring-2 focus-visible:ring-canvas focus-visible:outline-none";

export function Footer() {
  // Rendered on the server, so this is the year the page was built or
  // requested. Fine for a copyright line; nothing here needs a live clock.
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink">
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <div className="flex flex-col gap-6 border-b border-white/10 pb-12 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-canvas max-w-md text-[clamp(1.5rem,2.6vw,2rem)] leading-[1.15] font-bold tracking-[-0.03em] text-balance">
            The pothole outside your gate is a record waiting to be filed
          </h2>
          <Link
            href="/report"
            className="bg-brand hover:bg-brand-hover inline-flex h-12 w-fit shrink-0 items-center rounded-xl px-7 text-[0.9375rem] font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-canvas focus-visible:ring-offset-2 focus-visible:ring-offset-ink focus-visible:outline-none"
          >
            Report an issue
          </Link>
        </div>

        <div className="grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link
              href="/"
              className="text-canvas inline-flex items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-canvas focus-visible:ring-offset-4 focus-visible:ring-offset-ink focus-visible:outline-none"
            >
              <Mark />
              <span className="text-[1.25rem] font-bold tracking-[-0.02em]">
                CivicTrack
              </span>
              <span className="sr-only">, home</span>
            </Link>

            <p className="text-ink-muted mt-5 max-w-[38ch] text-[0.9375rem] leading-[1.6] text-pretty">
              A public register for civic problems. Report it, get a reference
              number, and follow it through every stage until a department marks
              it resolved.
            </p>
          </div>

          {SECTIONS.map((section) => (
            <nav key={section.title} aria-label={section.title}>
              <h3 className="text-canvas text-[0.8125rem] font-semibold">
                {section.title}
              </h3>
              <ul className="mt-3 flex flex-col gap-0.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className={LINK}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-muted font-mono text-[0.8125rem] tabular-nums">
            © {year} CivicTrack
          </p>
          <p className="text-ink-muted max-w-xl text-[0.8125rem] leading-[1.6]">
            Built for TEZHACK 2026 by Team CUCKOO. Reports filed here are a
            demonstration of the system, not a municipal service line: for an
            emergency, call the emergency number for your area.
          </p>
        </div>
      </div>
    </footer>
  );
}

/** The navbar wordmark glyph, on the dark ground: the shield takes the
 *  brighter green so it reads against `--ink`. Graphic only, never type. */
function Mark() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="size-8 shrink-0"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M16 2.5 28 7v10.2C28 24 22.8 28.6 16 30.5 9.2 28.6 4 24 4 17.2V7l12-4.5Z"
        fill="var(--color-brand-bright)"
      />
      <path
        d="M16 21.5c-3.4 0-5.6-2.3-5.6-5.9 0-3.9 2.4-6.9 5.6-8.6 3.2 1.7 5.6 4.7 5.6 8.6 0 3.6-2.2 5.9-5.6 5.9Z"
        fill="var(--color-ink)"
        fillOpacity={0.92}
      />
      <path
        d="M16 8.5v13"
        stroke="var(--color-brand-bright)"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </svg>
  );
}

export default Footer;
