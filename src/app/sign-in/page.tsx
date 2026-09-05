import { redirect } from "next/navigation";

import { getSession } from "@/modules/auth/session";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

export const metadata = { title: "Sign in" };

/**
 * Sign-in page. Deliberately plain — styling comes later, behaviour is what
 * matters now.
 *
 * `redirectTo` is set by middleware when it bounces an anonymous visitor, so
 * signing in returns them to the page they actually wanted.
 */
export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  // Already signed in? Nothing to do here.
  if (await getSession()) redirect("/");

  const { redirectTo } = await searchParams;
  // Only accept an internal path. An absolute URL here would let a crafted link
  // bounce a freshly signed-in user to another origin.
  const callbackURL =
    typeof redirectTo === "string" && redirectTo.startsWith("/")
      ? redirectTo
      : "/";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm opacity-70">
          Report public issues and follow their progress.
        </p>
      </div>

      <GoogleSignInButton callbackURL={callbackURL} />
    </main>
  );
}
