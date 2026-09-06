import { PinIcon } from "@/components/app/icons";
import { CATEGORY, StatusChip } from "@/components/dashboard/pieces";

/**
 * One record, two views.
 *
 * The bento above says what happens to a report. This says who it happens in
 * front of. Everything on the authority side of the product — triage, the
 * transition rules, the AI suggestion sitting beside the field rather than in
 * it — is otherwise invisible to someone who only reads the landing page.
 *
 * Composition, deliberately none of the three shapes already on this page: not
 * the bento's centred title over a tinted grid, not the register's left title
 * with a link on its baseline. One `--ink` stage, the heading inside it, and
 * two white panels of unequal width. That ink panel is the page's only dark
 * moment before the footer, which is what stops three white sections running
 * together.
 *
 * A specimen, not a mock control panel. Nothing here is a button, because a
 * button on a landing page that does not do the thing it names is a lie told in
 * a component. The reference number is #1024, the same example the FAQ uses.
 *
 * Every line is true of the build:
 *  - tracking needs no account; `GET /api/issues/track` takes the number alone
 *  - only legal transitions are offered, from `allowedTransitions(status)`
 *  - RESOLVED and REJECTED require a note, enforced in the workflow service
 *  - AI fields are stored beside the citizen's, and `reviewedAt` is stamped by
 *    an officer accepting or overriding, never by the model
 */

/** Read straight off the real record, in the order the citizen meets them. */
const TRAIL = [
  { label: "Report filed", at: "12 Feb, 09:14" },
  { label: "Acknowledged by Roads", at: "12 Feb, 11:02" },
  { label: "Waiting on: work assigned", at: null },
] as const;

/** What the officer's panel puts in front of them, as rows, not controls. */
const TRIAGE = [
  { field: "Category", value: "Roads", note: "AI suggested, officer confirmed" },
  { field: "Priority", value: "High", note: "AI suggested, officer confirmed" },
  { field: "Department", value: "Roads and transport", note: "Assigned" },
] as const;

/** From the state machine, for a report sitting at Acknowledged. */
const NEXT = ["Start work", "Resolve", "Reject"] as const;

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-body text-[0.75rem] font-medium tracking-[0.08em] uppercase">
      {children}
    </p>
  );
}

export function TwoSides() {
  return (
    <section id="two-sides" className="scroll-mt-32 pb-20 md:pb-28">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="bg-ink rounded-[1.75rem] px-6 py-12 md:rounded-[2.25rem] md:px-12 md:py-16">
          <div className="max-w-2xl">
            <h2 className="text-[clamp(1.875rem,3.2vw,2.75rem)] leading-[1.1] text-canvas font-bold tracking-[-0.03em] text-balance">
              The same record, from both sides
            </h2>
            <p className="text-ink-muted mt-4 max-w-[56ch] text-[1.0625rem] leading-[1.6] text-pretty">
              A citizen reads one row of the register. An officer works the same
              row. Neither gets a private copy, which is why the history a
              citizen can read is the history the officer wrote.
            </p>
          </div>

          {/* Unequal widths: the authority side carries more, and two equal
              columns would make this a comparison table of features. */}
          <div className="mt-10 grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            {/* ── Citizen ─────────────────────────────────────── */}
            <article className="flex flex-col rounded-2xl bg-white p-6 sm:p-8">
              <PanelLabel>What a citizen sees</PanelLabel>

              <div className="mt-5 flex items-start justify-between gap-3">
                <p className="text-ink font-mono text-[1.375rem] leading-none font-bold tabular-nums">
                  #1024
                </p>
                <StatusChip status="ACKNOWLEDGED" />
              </div>

              <p className="text-ink mt-3.5 text-[1.0625rem] leading-[1.35] font-semibold text-balance">
                Street light out on the river path
              </p>
              <p className="text-body mt-2 flex items-center gap-1.5 text-[0.8125rem]">
                <PinIcon className="size-3.5 shrink-0" />
                Riverside path, near the boat club
              </p>
              <p className="text-body mt-1.5 flex items-center gap-1.5 text-[0.8125rem]">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: CATEGORY.ROADS.color }}
                />
                Roads
              </p>

              {/* The trail, not a second timeline component: three rows is
                  cheaper here than lifting the real one out of the issue page,
                  and the real one stays the only thing rendering real data. */}
              <ol className="mt-6 space-y-0">
                {TRAIL.map((step, i) => (
                  <li key={step.label} className="flex gap-3.5">
                    <span
                      aria-hidden="true"
                      className="flex flex-col items-center"
                    >
                      <span
                        className={
                          step.at
                            ? "bg-brand mt-1.5 size-2.5 rounded-full"
                            : "border-field mt-1.5 size-2.5 rounded-full border-[1.5px] bg-white"
                        }
                      />
                      {i < TRAIL.length - 1 ? (
                        <span className="bg-line w-px flex-1" />
                      ) : null}
                    </span>
                    <span className="pb-5">
                      <span
                        className={
                          step.at
                            ? "text-ink block text-[0.875rem] font-medium"
                            : "text-body block text-[0.875rem]"
                        }
                      >
                        {step.label}
                      </span>
                      {step.at ? (
                        <span className="text-body block font-mono text-[0.75rem] tabular-nums">
                          {step.at}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>

              {/* No `mt-auto`: the trail is short, and pushing this line to the
                  taller neighbour's baseline opened a hole in the middle of the
                  card. The slack sits under the last line as padding instead. */}
              <p className="text-body border-line mt-6 border-t pt-5 text-[0.875rem] leading-[1.6]">
                Read with the number alone. Tracking a report needs no account
                and no sign-in.
              </p>
            </article>

            {/* ── Officer ─────────────────────────────────────── */}
            <article className="flex flex-col rounded-2xl bg-white p-6 sm:p-8">
              <PanelLabel>What an officer sees</PanelLabel>

              <div className="mt-5 flex items-start justify-between gap-3">
                <p className="text-ink font-mono text-[1.375rem] leading-none font-bold tabular-nums">
                  #1024
                </p>
                <span className="text-body font-mono text-[0.75rem]">
                  Roads and transport
                </span>
              </div>

              <dl className="divide-line border-line mt-5 divide-y border-y">
                {TRIAGE.map((row) => (
                  <div
                    key={row.field}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3.5"
                  >
                    <dt className="text-body w-24 shrink-0 text-[0.8125rem]">
                      {row.field}
                    </dt>
                    <dd className="text-ink text-[0.9375rem] font-medium">
                      {row.value}
                    </dd>
                    <dd className="text-body ml-auto text-[0.75rem]">
                      {row.note}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="text-body mt-5 text-[0.8125rem] leading-[1.6]">
                The model fills a second set of fields beside these, never over
                them. A report only counts as triaged once an officer has
                accepted or overridden each one.
              </p>

              <p className="text-body mt-6 text-[0.75rem] font-medium tracking-[0.08em] uppercase">
                Moves offered from here
              </p>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {NEXT.map((move) => (
                  <li
                    key={move}
                    className="border-brand-line text-brand rounded-lg border px-3 py-1.5 text-[0.8125rem] font-medium"
                  >
                    {move}
                  </li>
                ))}
              </ul>

              <p className="text-body border-line mt-auto border-t pt-5 text-[0.875rem] leading-[1.6]">
                Only the moves the workflow allows are offered, and closing a
                report needs a written reason before it will save.
              </p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TwoSides;
