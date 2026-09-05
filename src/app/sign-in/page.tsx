import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import authSkyline from "@/assets/auth-skyline.jpg";
import { AuthPanel } from "@/components/auth/auth-panel";
import { getSession } from "@/modules/auth/session";

export const metadata = { title: "Sign in" };

/**
 * Sign in.
 *
 * Split fold: the photograph holds the left half at full strength (no veil, no
 * copy over it, so it keeps its own colour), the form holds the right. Google
 * sits above the credential fields because it is the path most people will
 * take, and both are real: credential sign-in is enabled in the Better Auth
 * config, so nothing on this page is decoration.
 *
 * `redirectTo` is set by middleware when it bounces an anonymous visitor, so
 * signing in returns them to the page they actually wanted.
 */
export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  if (await getSession()) redirect("/");

  const { redirectTo } = await searchParams;
  // Only accept an internal path. An absolute URL here would let a crafted link
  // bounce a freshly signed-in user to another origin.
  const callbackURL =
    typeof redirectTo === "string" && redirectTo.startsWith("/")
      ? redirectTo
      : "/";

  return (
    <main className="grid min-h-[100svh] lg:grid-cols-2">
      {/* Plate. Decorative here: the page is titled and labelled in the form half. */}
      <div className="relative hidden lg:block">
        <Image
          src={authSkyline}
          alt=""
          fill
          sizes="50vw"
          placeholder="blur"
          preload
          className="object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,rgba(10,26,18,0.72),rgba(10,26,18,0))] p-10 pt-24">
          <p className="max-w-sm text-[1.375rem] leading-snug font-medium text-white">
            Cities are built by the people who report what is broken.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-col justify-center px-5 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link
            href="/"
            className="text-ink -my-2 inline-flex min-h-11 items-center gap-2.5 rounded-lg py-2 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 focus-visible:outline-none"
          >
            <Mark />
            <span className="text-[1.25rem] font-bold tracking-[-0.02em]">
              CivicTrack
            </span>
          </Link>

          <AuthPanel callbackURL={callbackURL} />
        </div>
      </div>
    </main>
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden="true" fill="none">
      <path
        d="M16 2.5 28 7v10.2C28 24 22.8 28.6 16 30.5 9.2 28.6 4 24 4 17.2V7l12-4.5Z"
        fill="var(--color-brand)"
      />
      <path
        d="M16 21.5c-3.4 0-5.6-2.3-5.6-5.9 0-3.9 2.4-6.9 5.6-8.6 3.2 1.7 5.6 4.7 5.6 8.6 0 3.6-2.2 5.9-5.6 5.9Z"
        fill="#fff"
        fillOpacity={0.92}
      />
      <path d="M16 8.5v13" stroke="var(--color-brand)" strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  );
}
