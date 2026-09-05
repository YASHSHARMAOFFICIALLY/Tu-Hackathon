/**
 * Demo data: ~50 realistic issues spread across departments, statuses,
 * priorities and the last 30 days.
 *
 * Usage:  bun run db:seed:demo
 *
 * Why this exists: an empty app is the fastest way to lose a judge. The
 * dashboard needs real distributions, the "over time" chart needs history, and
 * average resolution time needs issues that were actually resolved after a
 * plausible delay. The brief explicitly says real municipal integration is not
 * required, so seeded data is expected, not a shortcut.
 *
 * Deterministic: a fixed PRNG seed means the same dataset every run, so a
 * rehearsed demo matches the live one. Idempotent: everything it creates is
 * tagged and removed before re-seeding.
 */
import { eq, inArray, like } from "drizzle-orm";

import { db } from "@/db";
import { dbPool } from "@/db/pool";
import {
  comments,
  departments,
  issueDuplicates,
  issueHistory,
  issues,
  profiles,
  user,
} from "@/db/schema";
import type { IssueCategory, IssueStatus } from "@/db/schema/enums";

/** Marks every row this script owns, so re-running replaces rather than piles up. */
const SEED_PREFIX = "seed_";

/** Deterministic PRNG (mulberry32) — same demo data every time. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = rng(20260905);
const pick = <T,>(items: readonly T[]): T =>
  items[Math.floor(random() * items.length)];

const CITIZENS = [
  "Anita Sharma", "Bikash Das", "Chandan Bora", "Deepa Nath", "Farhan Ali",
  "Gitanjali Baruah", "Hemanta Kalita", "Ishita Roy",
] as const;

const OFFICERS = [
  ["Rakesh Deka", "Roads"],
  ["Sunita Devi", "Water Supply"],
  ["Manoj Saikia", "Electricity"],
  ["Priya Gogoi", "Sanitation"],
] as const;

/** Realistic complaints, grouped by the department that owns them. */
const TEMPLATES: Record<string, { category: IssueCategory; titles: string[] }> = {
  Roads: {
    category: "ROADS",
    titles: [
      "Huge pothole near university gate", "Road caved in after heavy rain",
      "Missing speed breaker near school", "Broken footpath outside market",
      "Faded zebra crossing at main junction", "Waterlogged road near bus stand",
    ],
  },
  "Water Supply": {
    category: "WATER_SUPPLY",
    titles: [
      "No water supply since two days", "Pipeline leaking near hostel gate",
      "Muddy water from tap", "Overflowing water tank on main road",
      "Low pressure in entire ward",
    ],
  },
  Electricity: {
    category: "ELECTRICITY",
    titles: [
      "Street light not working near park", "Exposed live wire on footpath",
      "Frequent power cuts in evening", "Transformer sparking near shop",
      "Dark stretch on campus road",
    ],
  },
  Sanitation: {
    category: "SANITATION",
    titles: [
      "Garbage not collected for a week", "Blocked drain overflowing",
      "Public toilet in poor condition", "Dead animal on roadside",
      "Illegal dumping behind market",
    ],
  },
  "Public Safety": {
    category: "PUBLIC_SAFETY",
    titles: [
      "Open manhole without cover", "Unsafe boundary wall leaning",
      "Stray dogs near school gate", "Broken railing at river bank",
    ],
  },
};

const ADDRESSES = [
  "Tezpur University Gate", "NH-15 near Kolibari", "Mission Chariali",
  "Ward 7, Bihaguri", "Napaam Main Road", "Dekargaon Bazaar",
  "Parbatia Crossing", "Baan Theatre Road",
] as const;

const DESCRIPTIONS = [
  "This has been a problem for several days and is getting worse.",
  "Multiple residents in the area have complained about this already.",
  "It is causing difficulty for pedestrians, especially in the evening.",
  "Requesting the concerned department to inspect and take action soon.",
  "The situation becomes dangerous after dark and during rain.",
] as const;

const RESOLUTIONS = [
  "Inspected and repaired by the field team. Verified on site.",
  "Work completed and area cleared. Photos filed with the department.",
  "Fixed by the maintenance crew; reporter informed by phone.",
] as const;

const DAY = 24 * 60 * 60 * 1000;

async function clearPrevious() {
  const seeded = await db
    .select({ id: user.id })
    .from(user)
    .where(like(user.id, `${SEED_PREFIX}%`));

  if (seeded.length === 0) return 0;

  const ids = seeded.map((s) => s.id);
  await dbPool.transaction(async (tx) => {
    // Issues cascade to history, comments, attachments and duplicate links.
    await tx.delete(issues).where(inArray(issues.reportedBy, ids));
    await tx.delete(user).where(inArray(user.id, ids));
  });
  return ids.length;
}

const cleared = await clearPrevious();
if (cleared) console.log(`Cleared ${cleared} previously seeded users and their issues.`);

const departmentRows = await db.select().from(departments);
if (departmentRows.length === 0) {
  console.error("No departments. Run: bun run db:seed:departments");
  process.exit(1);
}
const byName = new Map(departmentRows.map((d) => [d.name, d]));

// --- users -----------------------------------------------------------------
const citizenIds: string[] = [];
for (const [index, name] of CITIZENS.entries()) {
  const id = `${SEED_PREFIX}citizen_${index}`;
  citizenIds.push(id);
  await db.insert(user).values({
    id, name, email: `${id}@example.invalid`, emailVerified: true,
    createdAt: new Date(Date.now() - 40 * DAY), updatedAt: new Date(),
  });
  await db.insert(profiles).values({ userId: id, role: "CITIZEN", displayName: name.split(" ")[0] });
}

const officerIds = new Map<string, string>();
for (const [index, [name, dept]] of OFFICERS.entries()) {
  const id = `${SEED_PREFIX}officer_${index}`;
  officerIds.set(dept, id);
  await db.insert(user).values({
    id, name, email: `${id}@example.invalid`, emailVerified: true,
    createdAt: new Date(Date.now() - 40 * DAY), updatedAt: new Date(),
  });
  await db.insert(profiles).values({
    userId: id, role: "OFFICER", departmentId: byName.get(dept)?.id ?? null,
    displayName: name.split(" ")[0],
  });
}

// --- issues ----------------------------------------------------------------
/** Status mix chosen to look like a real backlog, not a uniform split. */
const STATUS_MIX: IssueStatus[] = [
  ...Array(9).fill("SUBMITTED"),
  ...Array(8).fill("ACKNOWLEDGED"),
  ...Array(12).fill("IN_PROGRESS"),
  ...Array(18).fill("RESOLVED"),
  ...Array(3).fill("REJECTED"),
];

const created: { id: string; departmentName: string; title: string }[] = [];

for (const status of STATUS_MIX) {
  const departmentName = pick(Object.keys(TEMPLATES));
  const template = TEMPLATES[departmentName];
  const department = byName.get(departmentName);
  const reporter = pick(citizenIds);
  const officer = officerIds.get(departmentName) ?? null;

  const ageDays = Math.floor(random() * 30);
  const createdAt = new Date(Date.now() - ageDays * DAY - Math.floor(random() * DAY));
  // Resolved issues close somewhere between a few hours and 5 days later.
  const resolvedAt =
    status === "RESOLVED"
      ? new Date(createdAt.getTime() + (4 + random() * 116) * 60 * 60 * 1000)
      : null;

  const priority = pick(["LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH", "CRITICAL"] as const);

  const [issue] = await db.insert(issues).values({
    title: pick(template.titles),
    description: pick(DESCRIPTIONS),
    category: template.category,
    address: pick(ADDRESSES),
    // Tezpur, with a little scatter so the map and duplicate radius are realistic.
    latitude: 26.63 + random() * 0.12,
    longitude: 92.75 + random() * 0.12,
    status, priority,
    reportedBy: reporter,
    assignedTo: status === "SUBMITTED" ? null : officer,
    departmentId: department?.id ?? null,
    resolutionNote: status === "RESOLVED" ? pick(RESOLUTIONS) : null,
    resolvedAt,
    createdAt, updatedAt: resolvedAt ?? createdAt,
  }).returning();

  created.push({ id: issue.id, departmentName, title: issue.title });

  // Timeline consistent with the status the issue ended up in.
  const events: (typeof issueHistory.$inferInsert)[] = [
    { issueId: issue.id, actorId: reporter, event: "CREATED", newStatus: "SUBMITTED", createdAt },
  ];
  const step = (from: IssueStatus, to: IssueStatus, at: Date, note?: string) =>
    events.push({
      issueId: issue.id, actorId: officer, event: "STATUS_CHANGED",
      oldStatus: from, newStatus: to, note, createdAt: at,
    });

  const t1 = new Date(createdAt.getTime() + 6 * 60 * 60 * 1000);
  const t2 = new Date(createdAt.getTime() + 20 * 60 * 60 * 1000);

  if (status === "ACKNOWLEDGED") step("SUBMITTED", "ACKNOWLEDGED", t1);
  if (status === "IN_PROGRESS") {
    step("SUBMITTED", "ACKNOWLEDGED", t1);
    step("ACKNOWLEDGED", "IN_PROGRESS", t2);
  }
  if (status === "RESOLVED" && resolvedAt) {
    step("SUBMITTED", "ACKNOWLEDGED", t1);
    step("ACKNOWLEDGED", "IN_PROGRESS", t2);
    step("IN_PROGRESS", "RESOLVED", resolvedAt, issue.resolutionNote ?? undefined);
  }
  if (status === "REJECTED") {
    step("SUBMITTED", "REJECTED", t1, "Outside municipal jurisdiction.");
  }
  await db.insert(issueHistory).values(events);

  // Roughly a third of issues carry a follow-up comment.
  if (random() < 0.35) {
    await db.insert(comments).values({
      issueId: issue.id, authorId: pick(citizenIds),
      body: pick([
        "Any update on this please?",
        "This is still not fixed as of today.",
        "Thank you, the work has been done.",
        "Nearby residents are facing the same problem.",
      ]),
      createdAt: new Date(createdAt.getTime() + 12 * 60 * 60 * 1000),
      updatedAt: new Date(createdAt.getTime() + 12 * 60 * 60 * 1000),
    });
  }
}

// --- duplicate links -------------------------------------------------------
// Group a few same-department reports, so "possible duplicate grouping" has
// something real to show on the dashboard and on the timeline.
let links = 0;
for (const department of Object.keys(TEMPLATES)) {
  const inDept = created.filter((c) => c.departmentName === department);
  if (inDept.length >= 3) {
    await db.insert(issueDuplicates).values({
      primaryIssueId: inDept[0].id,
      duplicateIssueId: inDept[1].id,
      linkedBy: officerIds.get(department) ?? null,
    }).onConflictDoNothing();
    await db.insert(issueHistory).values({
      issueId: inDept[1].id,
      actorId: officerIds.get(department) ?? null,
      event: "DUPLICATE_LINKED",
      note: "Grouped with an existing report of the same problem.",
    });
    links++;
  }
}

const totals = {
  citizens: citizenIds.length,
  officers: officerIds.size,
  issues: created.length,
  duplicateLinks: links,
};
console.log("Seeded demo data:", totals);
console.log("Promote yourself to admin with: bun run db:admin <your email>");
