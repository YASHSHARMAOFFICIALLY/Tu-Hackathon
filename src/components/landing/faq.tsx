"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * FAQ.
 *
 * One white panel with `--line` dividers rather than eight bordered cards: at
 * eight rows the repeated border reads as a table of boxes, and the divider
 * keeps the list scannable. The rows are real <button>s with visible text
 * labels, so WCAG 1.4.11 is satisfied by the label rather than by a boundary,
 * and the decorative hairline is the right token (§3).
 *
 * Every answer here has to stay true of the backend. §6 lists the claims the
 * UI is allowed to make; nothing below goes past them.
 */

const FAQS = [
  {
    question: "Do I need an account to report an issue?",
    answer:
      "Yes. Filing a report needs a signed-in account, so a report can be traced back to a person if a department needs to ask a question. Tracking is the part that needs no account.",
  },
  {
    question: "How do I follow a report I have already filed?",
    answer:
      "You are shown a reference number, like Issue #1024, as soon as the report is filed. Enter it on the tracking page and you get the current status and the history behind it, signed in or not.",
  },
  {
    question: "What do the statuses mean?",
    answer:
      "Submitted is filed and waiting. Acknowledged means a department has seen it. In progress means someone is working on it. Resolved means the department has closed it as done. Rejected means it cannot be acted on, and the report still stays on the record.",
  },
  {
    question: "What if someone has already reported the same thing?",
    answer:
      "The system looks before you submit, not after. It compares the category, the location within about a kilometre, and the wording of the title, then shows you the existing reports so you can follow one instead of adding a second.",
  },
  {
    question: "Does the AI decide what happens to my report?",
    answer:
      "No. It suggests a category, a priority, a department and a short summary, and those suggestions are stored beside your report rather than replacing anything in it. An officer accepts or overrides them. If the model is unavailable the report is filed exactly as you wrote it.",
  },
  {
    question: "Who can see my name?",
    answer:
      "The public view of an issue carries a first name at most. Email addresses, account ids and full names stay on the authority side, visible to the officers and administrators who act on the report.",
  },
  {
    question: "Can a report be deleted?",
    answer:
      "Not through the product. A report that cannot be acted on is marked Rejected and stays in the register with its history, because a record that can quietly disappear is not a public record.",
  },
  {
    question: "What happens to all of this data?",
    answer:
      "An administrator can export the whole register to a single versioned, checksummed file and restore from it. Email addresses can be replaced with stable placeholders when the file is going to leave trusted hands.",
  },
] as const;

export function Faq() {
  // One open row at a time: an accordion where everything can be open at once
  // stops being a scannable list. null = all closed.
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-32 pb-20 md:pb-28">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        {/* Centred over the list, the same shape the "how it works" section
            uses. The heading was a sticky left column; at eight rows the list
            is short enough that nothing ever scrolled past it, so the sticky
            column bought nothing and left the page with a third alignment. */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-ink text-[clamp(1.875rem,3.2vw,2.75rem)] leading-[1.1] font-bold tracking-[-0.03em] text-balance">
            Questions before you file
          </h2>
          <p className="text-body mx-auto mt-4 max-w-[58ch] text-[1.0625rem] leading-[1.6] text-pretty">
            What the system does with a report, and what it does not do with
            your name.
          </p>
        </div>

        <div className="border-line divide-line mx-auto mt-12 max-w-3xl divide-y overflow-hidden rounded-2xl border bg-white">
          {FAQS.map((faq, index) => {
            const open = openIndex === index;

            return (
              <div key={faq.question}>
                {/* A real <button>: keyboard focus, Enter and Space come free,
                    and aria-expanded carries the state the chevron only shows
                    visually. */}
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : index)}
                  aria-expanded={open}
                  aria-controls={`faq-panel-${index}`}
                  id={`faq-trigger-${index}`}
                  className="text-ink flex min-h-14 w-full items-center justify-between gap-5 px-5 py-4 text-left text-[1rem] leading-[1.4] font-medium transition-colors hover:bg-brand-tint/50 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset focus-visible:outline-none sm:px-7 sm:py-5"
                >
                  {faq.question}
                  <svg
                    viewBox="0 0 20 20"
                    className={cn(
                      "text-brand size-5 shrink-0 transition-transform duration-300 motion-reduce:transition-none",
                      open && "rotate-45",
                    )}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M10 4v12M4 10h12" />
                  </svg>
                </button>

                {/* CSS grid 0fr -> 1fr instead of a JS height animation: it
                    measures the answer itself, so no max-height guess clips a
                    long one. `inert` keeps a collapsed answer out of the tab
                    order and the accessibility tree, which overflow:hidden
                    alone does not. */}
                <div
                  id={`faq-panel-${index}`}
                  role="region"
                  aria-labelledby={`faq-trigger-${index}`}
                  inert={!open}
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                    open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="text-body max-w-[68ch] px-5 pb-5 text-[0.9375rem] leading-[1.7] text-pretty sm:px-7 sm:pb-6">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default Faq;
