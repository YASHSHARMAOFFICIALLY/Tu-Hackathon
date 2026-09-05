/**
 * Promote a user to ADMIN by email.
 *
 * Usage: bun run db:admin you@example.com
 *
 * Deliberately a script, not an API: there must be no self-service path to
 * ADMIN. The user has to have signed in at least once so their profile exists.
 */
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { profiles, user } from "@/db/schema";

const email = process.argv[2];
if (!email) {
  console.error("Usage: bun run db:admin <email>");
  process.exit(1);
}

const [account] = await db
  .select({ id: user.id, name: user.name })
  .from(user)
  .where(eq(user.email, email))
  .limit(1);

if (!account) {
  console.error(
    `No user with email ${email}. They must sign in with Google once first.`,
  );
  process.exit(1);
}

const updated = await db
  .update(profiles)
  .set({ role: "ADMIN", updatedAt: new Date() })
  .where(eq(profiles.userId, account.id))
  .returning({ role: profiles.role });

if (updated.length === 0) {
  console.error(
    `User ${email} exists but has no profile row — the sign-up hook did not run.`,
  );
  process.exit(1);
}

console.log(`${account.name} <${email}> is now ${updated[0].role}.`);
