"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Landing navigation.
 *
 * Two states, one element. At the top of the page the bar is the full 1440
 * width and completely transparent, so the hero photograph runs behind it
 * uninterrupted. Past 16px of scroll it contracts into a floating pill: a
 * narrower container, a rounded-full edge, and a translucent white ground with
 * a backdrop blur behind it.
 *
 * The blur is the whole effect and it is worth being careful about, because
 * translucent chrome is where readable interfaces usually go to die. Two rules
 * keep it honest:
 *
 *   1. The ground is 78% white, not 40%. Over the darkest thing that can pass
 *      under it (the `--ink` panel in "both sides") the composite is about
 *      #b9bdba, and `--ink` on that measures 8.4:1. Over the page's white it is
 *      effectively white. There is no scroll position where the labels get
 *      thin.
 *   2. `backdrop-blur` is a progressive enhancement. A browser that ignores it
 *      still gets the 78% ground, which is what carries the contrast.
 *
 * The four links are centred on the container in both states rather than
 * sitting next to the wordmark: absolutely positioned, so their centre does not
 * drift when the wordmark or the buttons change width.
 *
 * Every destination here is a route that exists. Nothing points at a section
 * that has not been built: a nav item with nowhere to go is a dead control.
 */

const LINKS = [
  { href: "/", label: "Home", current: true },
  { href: "/report", label: "Report" },
  { href: "/track", label: "Track" },
  { href: "/issues", label: "Live issues" },
] as const;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Escape closes the mobile sheet, and the page behind it must not scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 px-4 md:px-8">
      <nav
        aria-label="Main"
        className={cn(
          // Named properties, never `transition-all`: the transition has to
          // cover the width and the ground, and nothing else on this element
          // should animate by accident.
          "relative mx-auto flex items-center transition-[max-width,height,transform,border-radius,background-color,border-color,box-shadow,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          scrolled
            ? "h-16 max-w-5xl translate-y-3 rounded-full border border-white/60 bg-white/[0.78] px-4 shadow-[0_10px_36px_-16px_rgb(22_36_29/0.35)] backdrop-blur-xl md:px-5"
            : "h-20 max-w-[1440px] translate-y-0 rounded-full border border-transparent bg-transparent px-0",
        )}
      >
        <Link
          href="/"
          className="-my-2 flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg py-2 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 focus-visible:outline-none"
        >
          <Mark />
          <span className="text-ink min-w-0 text-[1.375rem] font-bold tracking-[-0.02em]">
            CivicTrack
          </span>
        </Link>

        {/* Absolutely centred so the group's midpoint is the container's
            midpoint, whatever the wordmark and the buttons either side weigh.
            A flex `justify-center` between two unequal siblings is centred only
            by coincidence. */}
        <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex">
          {LINKS.map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                aria-current={"current" in link && link.current ? "page" : undefined}
                className={`relative block rounded-lg px-3.5 py-2 text-[0.9375rem] transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none ${
                  "current" in link && link.current
                    ? "text-brand font-medium"
                    : "text-body hover:text-ink"
                }`}
              >
                {link.label}
                {"current" in link && link.current ? (
                  <span
                    aria-hidden="true"
                    className="bg-brand absolute inset-x-3.5 -bottom-0.5 h-0.5 rounded-full"
                  />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ml-auto hidden items-center gap-3 lg:flex">
          <Link
            href="/sign-in"
            className="border-field text-ink hover:border-brand hover:bg-brand-tint inline-flex h-11 items-center rounded-xl border bg-white px-5 text-[0.9375rem] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Log in
          </Link>
          <Link
            href="/report"
            className="bg-brand hover:bg-brand-hover inline-flex h-11 items-center rounded-xl px-5 text-[0.9375rem] font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Report an issue
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className="text-ink -mr-2.5 ml-auto inline-flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none lg:hidden"
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </nav>

      {open ? (
        <div
          id="mobile-menu"
          className="border-line bg-canvas/95 mx-auto mt-2 max-w-5xl rounded-2xl border px-3 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_16px_40px_-20px_rgb(22_36_29/0.45)] backdrop-blur-xl lg:hidden"
        >
          <ul>
            {LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-ink flex min-h-12 items-center rounded-lg px-2 text-base transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-line mt-3 flex flex-col gap-2 border-t pt-4">
            <Link
              href="/sign-in"
              onClick={() => setOpen(false)}
              className="border-field text-ink flex min-h-12 items-center justify-center rounded-xl border bg-white px-5 text-base font-medium focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              Log in
            </Link>
            <Link
              href="/report"
              onClick={() => setOpen(false)}
              className="bg-brand flex min-h-12 items-center justify-center rounded-xl px-5 text-base font-medium text-white focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Report an issue
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

/** Wordmark glyph: a leaf-in-shield, drawn rather than imported. */
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
        fill="var(--color-brand)"
      />
      <path
        d="M16 21.5c-3.4 0-5.6-2.3-5.6-5.9 0-3.9 2.4-6.9 5.6-8.6 3.2 1.7 5.6 4.7 5.6 8.6 0 3.6-2.2 5.9-5.6 5.9Z"
        fill="#fff"
        fillOpacity={0.92}
      />
      <path
        d="M16 8.5v13"
        stroke="var(--color-brand)"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
