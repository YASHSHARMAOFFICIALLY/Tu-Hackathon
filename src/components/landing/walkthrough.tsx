/**
 * The recorded walkthrough.
 *
 * Everything else on this page describes the product in prose and specimens.
 * This is the product itself, running: one unbroken screen recording of a
 * report being filed, triaged by an officer, and the register being backed up
 * and restored. Nothing in it is staged in a design tool.
 *
 * Three decisions worth keeping:
 *
 *   1. `preload="none"` with a poster. The file is tens of megabytes, and a
 *      landing page that spends that on every visitor before anyone presses
 *      play is a page that loads slowly for the majority who never do. The
 *      poster is a real frame from the recording, so the still and the video
 *      cannot disagree.
 *   2. Native controls, no custom player. A bespoke play button means
 *      re-implementing keyboard access, scrubbing, captions and full screen,
 *      all of which the browser already ships correctly.
 *   3. `width`/`height` on the element. They fix the aspect box before the
 *      video loads, so the section does not jump when it does.
 *
 * The section sits on the page's own white, and runs directly into the ink
 * panel below it. The frame around the video is a hairline and a soft shadow —
 * enough to seat a bright rectangle on the page, not a fake browser chrome.
 *
 * One centred line above it and nothing else: the recording is the argument,
 * and a paragraph explaining a video someone is about to watch is a paragraph
 * they read instead of watching.
 */

/** Read off the recording, in the order the walkthrough visits them. */
const COVERED = [
  "Filing a report, with the duplicate check running before it saves",
  "An officer triaging it: category, priority, department, then a status move",
  "The dashboard the office reads, counted straight off the register",
  "A backup taken and restored inside a single transaction",
] as const;

export function Walkthrough() {
  return (
    <section id="walkthrough" className="scroll-mt-32 py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <h2 className="text-ink mx-auto max-w-[18ch] text-center text-[clamp(1.875rem,3.2vw,2.75rem)] leading-[1.1] font-bold tracking-[-0.03em] text-balance">
          The whole thing, running
        </h2>

        <figure className="mt-10">
          <video
            controls
            preload="none"
            playsInline
            poster="/walkthrough-poster.webp"
            width={1920}
            height={952}
            className="border-line block h-auto w-full rounded-2xl border bg-black shadow-[0_24px_60px_-32px_rgb(22_36_29/0.45)]"
          >
            <source src="/walkthrough.mp4" type="video/mp4" />
            Your browser cannot play this video.{" "}
            <a href="/walkthrough.mp4" className="text-brand underline">
              Download it instead
            </a>
            .
          </video>

          <figcaption className="mt-6 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {COVERED.map((line) => (
              <p
                key={line}
                className="text-body flex gap-2.5 text-[0.9375rem] leading-[1.55]"
              >
                <span
                  aria-hidden="true"
                  className="bg-brand mt-2 size-1.5 shrink-0 rounded-full"
                />
                {line}
              </p>
            ))}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

export default Walkthrough;
