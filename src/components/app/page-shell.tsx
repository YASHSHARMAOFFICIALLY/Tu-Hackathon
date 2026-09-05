import { AppShell, type NavItem } from "@/components/app/shell";
import { getCurrentUser, type CurrentUser } from "@/modules/auth/permissions";

/**
 * The shell every application screen wraps itself in.
 *
 * It resolves the session itself rather than taking a user prop, because
 * `getCurrentUser` is `cache()`d per request: a page that also needs the user
 * for its own branching still costs one session lookup between the two calls.
 *
 * The nav is assembled here rather than inside `AppShell` because it is
 * role-shaped, and the rule is the same one the services follow — a link is
 * never the authorization, but offering a citizen a page that will refuse them
 * is a bug in the product, not a security control.
 */
export async function PageShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <AppShell
      nav={navFor(user)}
      user={user ? { name: user.displayName ?? user.name, role: user.role } : null}
      title={title}
    >
      {children}
    </AppShell>
  );
}

export function navFor(user: CurrentUser | null): NavItem[] {
  return [
    { href: "/", label: "Home", icon: "home" },
    // The register and the tracker are public; the dashboard is not, so it is
    // only offered to someone who has somewhere to land.
    ...(user
      ? [{ href: "/dashboard", label: "Dashboard", icon: "chart" as const }]
      : []),
    { href: "/report", label: "Report an issue", icon: "report" },
    { href: "/issues", label: "All issues", icon: "list" },
    { href: "/track", label: "Track a report", icon: "pin" },
    ...(user?.role === "ADMIN"
      ? [{ href: "/admin/backup", label: "Backup", icon: "archive" as const }]
      : []),
  ];
}
