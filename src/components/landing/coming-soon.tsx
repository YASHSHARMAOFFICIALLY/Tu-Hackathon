import Link from "next/link";

/**
 * Honest placeholder for a Phase 10 route.
 *
 * The landing page links to these, so they have to resolve to something real
 * rather than a 404. Each one names what will live here and points at the API
 * that already backs it, so the route is a stub, not a lie.
 */
export function ComingSoon({
  title,
  description,
  endpoint,
}: {
  title: string;
  description: string;
  endpoint: string;
}) {
  return (
    <main className="mx-auto flex min-h-[100svh] max-w-2xl flex-col justify-center px-4 py-20 md:px-8">
      <p className="text-brand text-[0.8125rem] font-medium">Coming soon</p>
      <h1 className="text-ink mt-3 text-[clamp(2rem,4vw,3rem)] leading-[1.05] font-bold tracking-[-0.03em]">
        {title}
      </h1>
      <p className="text-body mt-5 max-w-prose text-[1.0625rem] leading-[1.6]">
        {description}
      </p>
      <p className="text-body mt-6 text-[0.875rem]">
        The API behind it is built and tested:{" "}
        <code className="bg-brand-tint text-brand rounded-md px-1.5 py-0.5 font-mono text-[0.8125rem]">
          {endpoint}
        </code>
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
