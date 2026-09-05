"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Landing navigation.
 *
 * Transparent so the hero photograph runs behind it; it only grows a surface
 * once the page scrolls past the hero, where the content behind it is no longer
 * guaranteed to be pale.
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
    <header
      className={`sticky top-0 z-50 transition-[background-color,box-shadow] duration-300 ${
        scrolled
          ? "bg-canvas/85 shadow-[0_1px_0_var(--color-line)] backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-20 max-w-[1440px] items-center gap-10 px-4 md:px-8"
      >
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 focus-visible:outline-none"
        >
          <Mark />
          <span className="text-ink text-[1.375rem] font-bold tracking-[-0.02em]">
            CivicTrack
          </span>
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
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
            className="border-line text-ink hover:border-brand/40 hover:bg-brand-tint/60 inline-flex h-11 items-center rounded-xl border bg-white/70 px-5 text-[0.9375rem] font-medium backdrop-blur-sm transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
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
          className="text-ink -mr-2.5 ml-auto inline-flex size-11 items-center justify-center rounded-lg transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none lg:hidden"
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </nav>

      {open ? (
        <div
          id="mobile-menu"
          className="bg-canvas border-line border-t px-4 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:hidden"
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
              className="border-line text-ink flex min-h-12 items-center justify-center rounded-xl border bg-white px-5 text-base font-medium focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
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
