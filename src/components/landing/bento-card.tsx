import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * "How it works" bento.
 *
 * Tinted cards on a white page. Each card is one flat tint with no border: the
 * tint is the edge, and a border on top of a fill would draw the boundary
 * twice and turn the grid into a table. Four tints across six cards, not six,
 * so the section reads as one palette instead of a swatch board (§3).
 *
 * The section is held to `max-w-6xl` rather than the hero's 1440, so the cards
 * sit inside a margin and the full-bleed photograph above stays the only
 * edge-to-edge thing on the page.
 *
 * Every card states something the backend actually does. The mono index in the
 * corner is the one repeated ornament, and it is the product's own texture:
 * reference numbers are what a citizen holds. There is no tracked uppercase
 * eyebrow above this section, because the hero already spends the one kicker
 * this page is allowed (§9).
 */

type Tint = "mint" | "sky" | "lilac" | "sand";

/* Flat, even fill. A diagonal white-to-tint wash was tried first and it split
   every card visibly in half: white on the left, colour on the right. One
   colour across the whole card is what the reference comp actually does. */
const TINT: Record<Tint, string> = {
  mint: "bg-tint-mint",
  sky: "bg-tint-sky",
  lilac: "bg-tint-lilac",
  sand: "bg-tint-sand",
};

const CARD =
  "relative flex flex-col items-center rounded-3xl p-8 text-center transition-transform duration-300 motion-safe:hover:-translate-y-1 sm:p-10";

function Card({
  index,
  tint,
  icon,
  title,
  children,
  className,
  footer,
}: {
  index: string;
  tint: Tint;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}) {
  return (
    <article className={cn(CARD, TINT[tint], className)}>
      <span
        aria-hidden="true"
        className="text-brand/30 absolute top-7 right-7 font-mono text-[0.75rem] tabular-nums sm:top-8 sm:right-8"
      >
        {index}
      </span>

      {/* A white disc on the tint: the icon sits on the page's own ground, so
          the tint stays a surface rather than a background for a second box. */}
      <span className="text-brand flex size-12 shrink-0 items-center justify-center rounded-full bg-white">
        {icon}
      </span>

      <h3 className="text-ink mt-7 text-[1.1875rem] leading-[1.25] font-bold tracking-[-0.02em] text-balance">
        {title}
      </h3>
      <p className="text-body mt-3 text-[0.9375rem] leading-[1.65] text-pretty">
        {children}
      </p>

      {footer}
    </article>
  );
}

/**
 * The status orbit.
 *
 * Four stages around a hub, one lit at a time. The viewBox is wider than the
 * 240-unit artwork and offset -34 on x, because the side captions are anchored
 * outside the ring: "Acknowledged" runs past 258 and "Resolved" back past -16,
 * and a plain 0..240 box cut both in half.
 *
 * Everything moves on CSS keyframes sharing one 8s period (globals.css), so
 * there is no interval, no state, and this stays a server component.
 */
const ORBIT = [
  { n: 1, label: "Submitted", x: 120, y: 50 },
  { n: 2, label: "Acknowledged", x: 190, y: 120 },
  { n: 3, label: "In progress", x: 120, y: 190 },
  { n: 4, label: "Resolved", x: 50, y: 120 },
] as const;

function Orbit() {
  return (
    <div className="mt-auto flex flex-1 flex-col justify-center pt-8">
      {/* Symmetric about the hub at x=120, and wide enough for the longest
          caption: "Acknowledged" is anchored outside the ring and ran past a
          tighter box, which clipped it mid-word. */}
      <svg
        viewBox="-70 12 380 220"
        className="mx-auto w-full max-w-[420px]"
        aria-hidden="true"
      >
        {/* The track the arc travels along. */}
        <circle
          cx="120"
          cy="120"
          r="70"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-brand/20"
        />

        {/* One quarter of the ring, stepped round a quarter at a time. */}
        <path
          d="M 120 50 A 70 70 0 0 1 190 120"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          className="orbit-arc text-brand"
        />

        {/* Dashed ring around the hub, turning slowly. */}
        <circle
          cx="120"
          cy="120"
          r="38"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="3 6"
          className="orbit-ring text-brand/30"
        />

        {/* White and smaller than the stage nodes' ring, so the hub is the
            quiet centre the stages travel around rather than a black weight
            pinning the middle of the card. */}
        <circle
          cx="120"
          cy="120"
          r="26"
          className="fill-white stroke-brand/20"
          strokeWidth="1.5"
        />
        <text
          x="120"
          y="123.5"
          textAnchor="middle"
          className="fill-brand text-[8px] font-bold tracking-[0.14em]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          STATUS
        </text>

        {ORBIT.map((step, i) => {
          const delay = `${i * 2}s`;
          return (
            <g key={step.label}>
              <circle
                cx={step.x}
                cy={step.y}
                r="17"
                className="orbit-node fill-white stroke-brand/25"
                strokeWidth="1.5"
                style={{ animationDelay: delay }}
              />
              <text
                x={step.x}
                y={step.y + 4}
                textAnchor="middle"
                className="orbit-label fill-brand text-[12px] font-bold"
                style={{ animationDelay: delay }}
              >
                {step.n}
              </text>
              {/* Captions sit outside the ring so they never collide with it. */}
              <text
                x={step.x + (step.x === 190 ? 26 : step.x === 50 ? -26 : 0)}
                y={step.y + (step.y === 50 ? -26 : step.y === 190 ? 34 : 4)}
                textAnchor={
                  step.x === 190 ? "start" : step.x === 50 ? "end" : "middle"
                }
                className="orbit-caption fill-body text-[12px] font-semibold"
                style={{ animationDelay: delay }}
              >
                {step.label}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="text-body mx-auto mt-6 max-w-[46ch] border-t border-brand/15 pt-5 text-[0.875rem] leading-[1.6]">
        A fifth status, <span className="text-ink font-semibold">Rejected</span>,
        closes a report that cannot be acted on. Nothing is deleted, and the
        entry stays in the history with the rest.
      </p>
    </div>
  );
}

export function BentoCard() {
  return (
    <section id="how-it-works" className="scroll-mt-32 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-ink text-[clamp(1.875rem,3.2vw,2.75rem)] leading-[1.1] font-bold tracking-[-0.03em] text-balance">
            What happens after you press submit
          </h2>
          <p className="text-body mx-auto mt-4 max-w-[58ch] text-[1.0625rem] leading-[1.6] text-pretty">
            A report is a record, not a message into a form. It gets a number, a
            department, a status, and a history that anyone holding the number
            can read.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card
            index="01"
            tint="sky"
            icon={<RouteIcon />}
            title="A status, and a timestamped history behind it."
            className="lg:col-span-2 lg:row-span-2"
            footer={<Orbit />}
          >
            Every status change, assignment and priority change is written to
            the issue history with the time it happened, so the timeline shows
            who moved the report and when, not just where it ended up.
          </Card>

          <Card
            index="02"
            tint="mint"
            icon={<HashIcon />}
            title="A reference number you can read out loud."
          >
            You are shown <span className="text-ink font-mono">Issue #1024</span>{" "}
            the moment the report is filed. Anyone with that number can check the
            progress, with no account and no sign-in.
          </Card>

          <Card
            index="03"
            tint="lilac"
            icon={<LayersIcon />}
            title="Duplicates are caught before you submit, not after."
          >
            The check runs on what the form already holds: same category, within
            about a kilometre, and a trigram match on the title. Existing reports
            come back before a second one is created.
          </Card>

          <Card
            index="04"
            tint="sand"
            icon={<TagIcon />}
            title="AI suggests the triage. An officer decides it."
          >
            Category, priority, department and a short summary are stored beside
            the real fields, never instead of them. With no model key configured
            the report is filed exactly as you wrote it.
          </Card>

          <Card
            index="05"
            tint="lilac"
            icon={<BuildingIcon />}
            title="The report reaches a department, not an inbox."
          >
            Issues are assigned to a department, and an officer acts within
            theirs. Public views carry a first name at most, never an email
            address or an account id.
          </Card>

          <Card
            index="06"
            tint="mint"
            icon={<ArchiveIcon />}
            title="The whole register exports, and restores."
            className="md:col-span-2 lg:col-span-1"
            footer={
              <Link
                href="/issues"
                className="text-brand mx-auto mt-6 inline-flex h-11 w-fit items-center rounded-lg text-[0.9375rem] font-medium underline decoration-current/30 underline-offset-4 transition-colors hover:decoration-current focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                See the live issues
              </Link>
            }
          >
            Every table exports to one versioned file, checksummed, with the
            option to strip email addresses before it leaves trusted hands. The
            same file restores the register.
          </Card>
        </div>
      </div>
    </section>
  );
}

/* Inline SVG, 1.75 stroke, per §9: no icon dependency for six marks. */

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function RouteIcon() {
  return (
    <Icon>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.5 6H14a3.5 3.5 0 0 1 0 7h-4a3.5 3.5 0 0 0 0 7h5.5" />
    </Icon>
  );
}

function HashIcon() {
  return (
    <Icon>
      <path d="M4.5 9h15M4.5 15h15M10 4l-1.5 16M17 4l-1.5 16" />
    </Icon>
  );
}

function LayersIcon() {
  return (
    <Icon>
      <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" />
      <path d="m4 12.5 8 4.5 8-4.5" />
      <path d="m4 17 8 4.5 8-4.5" />
    </Icon>
  );
}

/** A label, not a sparkle: triage attaches a category, a priority and a
 *  department to a report. The sparkle is the generic "AI" glyph and says
 *  nothing about what the step does. */
function TagIcon() {
  return (
    <Icon>
      <path d="M4 11.2V5a1 1 0 0 1 1-1h6.2a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8l-5.8 5.8a2 2 0 0 1-2.8 0l-7-7a2 2 0 0 1-.6-1.4Z" />
      <circle cx="8.5" cy="8.5" r="1.4" />
    </Icon>
  );
}

function BuildingIcon() {
  return (
    <Icon>
      <path d="M4 20h16M6 20V5.5A1.5 1.5 0 0 1 7.5 4h6A1.5 1.5 0 0 1 15 5.5V20M15 10h2.5A1.5 1.5 0 0 1 19 11.5V20" />
      <path d="M9 8h3M9 12h3M9 16h3" />
    </Icon>
  );
}

function ArchiveIcon() {
  return (
    <Icon>
      <ellipse cx="12" cy="6" rx="7.5" ry="3" />
      <path d="M4.5 6v12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6" />
      <path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
    </Icon>
  );
}

export default BentoCard;
