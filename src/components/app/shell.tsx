"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  ArchiveIcon,
  ChartIcon,
  HomeIcon,
  ListIcon,
  MenuIcon,
  PinIcon,
  ReportIcon,
} from "@/components/app/icons";
import { cn } from "@/lib/utils";

/**
 * The signed-in application shell: a dark rail on the left, a thin bar on top,
 * and the page underneath.
 *
 * Why a rail at all. Everything before this hung one route off a header, so
 * every screen after sign-in looked like a document rather than a product, and
 * moving between "my reports", "file one" and "the register" meant going back
 * to the marketing page. The rail is the place those live.
 *
 * It collapses to a 4.5rem icon strip, which is the state the working screens
 * (report, issue detail) want: the nav is still one click away but the form
 * keeps the width. The state is per-visit and deliberately not persisted —
 * ponytail: no localStorage, add it the day someone asks for the rail to
 * remember.
 *
 * The rail is `hidden lg:flex`. Below that width it would eat a third of a
 * phone, so the same links ride the top bar instead as a scrolling row.
 */

const ICONS = {
  home: HomeIcon,
  report: ReportIcon,
  list: ListIcon,
  chart: ChartIcon,
  pin: PinIcon,
  archive: ArchiveIcon,
} as const;

export type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
};

export function AppShell({
  nav,
  user,
  title,
  children,
}: {
  nav: NavItem[];
  /** Null for an anonymous visitor: the register and the tracker are public. */
  user: { name: string; role: string } | null;
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const pathname = usePathname();

  return (
    <div className="bg-surface flex min-h-[100svh]">
      <Rail nav={nav} open={open} pathname={pathname} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line bg-canvas/85 sticky top-0 z-10 flex h-14 items-center gap-3 border-b px-4 backdrop-blur md:px-6">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Collapse the navigation" : "Expand the navigation"}
            className="text-body hover:bg-surface hover:text-ink hidden size-10 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none lg:inline-flex"
          >
            <MenuIcon className="size-[18px]" />
          </button>

          <p className="text-ink truncate text-[0.9375rem] font-semibold tracking-[-0.01em]">
            {title}
          </p>

          {/* Search belongs in the bar because it is the fastest route into the
              register from anywhere. A GET form, so it works before hydration
              and lands on a URL that can be shared. */}
          <form
            method="get"
            action="/issues"
            role="search"
            className="ml-4 hidden min-w-0 max-w-sm flex-1 md:block"
          >
            <label>
              <span className="sr-only">Search the register</span>
              <input
                type="search"
                name="q"
                placeholder="Search issues, places, keywords…"
                className="border-line bg-surface text-ink placeholder:text-placeholder h-10 w-full rounded-full border px-4 text-[0.8125rem] focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand focus-visible:outline-none"
              />
            </label>
          </form>

          <div className="ml-auto flex items-center gap-3">
            <span className="border-line text-body hidden items-center gap-2 rounded-full border px-3 py-1.5 text-[0.75rem] sm:inline-flex">
              <span
                aria-hidden="true"
                className="bg-brand-bright size-1.5 rounded-full"
              />
              Live register
            </span>
            {user ? (
              <>
                <span className="bg-brand-tint text-brand flex size-9 shrink-0 items-center justify-center rounded-full text-[0.8125rem] font-semibold">
                  {initials(user.name)}
                </span>
                <span className="hidden leading-tight sm:block">
                  <span className="text-ink block text-[0.8125rem] font-medium">
                    {user.name}
                  </span>
                  <span className="text-body block font-mono text-[0.6875rem]">
                    {user.role}
                  </span>
                </span>
              </>
            ) : (
              <Link
                href="/sign-in"
                className="bg-brand hover:bg-brand-hover inline-flex h-9 items-center rounded-lg px-4 text-[0.8125rem] font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Sign in
              </Link>
            )}
          </div>
        </header>

        {/* The rail's stand-in below `lg`. Same links, same active state. */}
        <nav
          aria-label="Sections"
          className="border-line bg-canvas flex gap-1 overflow-x-auto border-b px-4 py-2 lg:hidden"
        >
          {nav.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[0.8125rem] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none",
                  active
                    ? "bg-brand text-white"
                    : "text-body hover:bg-surface hover:text-ink",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-9">{children}</main>
      </div>
    </div>
  );
}

/* ── Rail ───────────────────────────────────────────────────── */

function Rail({
  nav,
  open,
  pathname,
}: {
  nav: NavItem[];
  open: boolean;
  pathname: string;
}) {
  return (
    <aside
      className={cn(
        "bg-ink sticky top-0 hidden h-[100svh] shrink-0 flex-col overflow-hidden py-4 transition-[width] duration-300 ease-out lg:flex",
        open ? "w-60 px-3" : "w-[4.5rem] px-2",
      )}
    >
      <Link
        href="/"
        className={cn(
          "flex items-center gap-2.5 rounded-xl px-2 py-2 focus-visible:ring-2 focus-visible:ring-canvas focus-visible:outline-none",
          !open && "justify-center px-0",
        )}
      >
        <Mark />
        {open ? (
          <span className="min-w-0">
            <span className="text-canvas block text-[0.9375rem] leading-tight font-semibold tracking-[-0.01em]">
              CivicTrack
            </span>
            <span className="text-ink-muted block text-[0.6875rem] leading-tight">
              Public issue tracker
            </span>
          </span>
        ) : null}
      </Link>

      {/* The one action the rail carries. Filing a report is what a citizen
          opens the product to do, so it is a button rather than a nav row. */}
      <Link
        href="/report"
        className={cn(
          "bg-brand hover:bg-brand-hover mt-5 flex h-11 items-center justify-center gap-2 rounded-xl text-[0.875rem] font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-canvas focus-visible:ring-offset-2 focus-visible:ring-offset-ink focus-visible:outline-none",
          open ? "px-3" : "px-0",
        )}
      >
        <ReportIcon className="size-[18px] shrink-0" />
        {open ? "Report an issue" : <span className="sr-only">Report an issue</span>}
      </Link>

      <nav aria-label="Main" className="mt-4 flex flex-col gap-1">
        {nav.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={open ? undefined : item.label}
              className={cn(
                "flex h-11 items-center gap-3 rounded-xl text-[0.875rem] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-canvas focus-visible:ring-offset-2 focus-visible:ring-offset-ink focus-visible:outline-none",
                open ? "px-3" : "justify-center px-0",
                active
                  ? "bg-brand text-white"
                  : "text-ink-muted hover:bg-white/8 hover:text-canvas",
              )}
            >
              <Icon className="size-[18px] shrink-0" />
              {open ? <span className="truncate">{item.label}</span> : null}
              {/* The label still reaches a screen reader in the collapsed rail,
                  where the visible text is gone. */}
              {open ? null : <span className="sr-only">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {open ? (
        <p className="text-ink-muted mt-auto px-3 pb-1 font-script text-[1.375rem] leading-[1.25]">
          Cleaner, safer,
          <br />
          stronger together.
        </p>
      ) : null}
    </aside>
  );
}

/** The logo mark: the roof of a civic building over a bar of reports. */
function Mark() {
  return (
    <span className="bg-brand flex size-9 shrink-0 items-center justify-center rounded-xl">
      <svg
        viewBox="0 0 24 24"
        className="size-5 text-white"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3.5 9.5 12 4l8.5 5.5" />
        <path d="M6.5 11v6.5M12 11v6.5M17.5 11v6.5" />
        <path d="M4 20h16" />
      </svg>
    </span>
  );
}

/* ── Helpers ────────────────────────────────────────────────── */

/** `/dashboard` must not light up on `/dashboards-something`, and `/` only
 *  matches itself, so the prefix test needs the boundary. */
function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
