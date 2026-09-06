/**
 * The resolution copilot.
 *
 * An officer opening an issue gets two things: the steps a municipal officer
 * would actually take next, and a draft of the update the citizen is waiting
 * for. Both are suggestions. The officer edits and posts, from their own
 * account, or ignores them.
 *
 * NOTHING HERE IS STORED. A suggestion an officer did not act on is not a fact
 * about the issue, and every column added to `issues` is a column the backup,
 * the restore and the format version have to carry forever. Once the officer
 * posts the update it becomes an ordinary comment written by them, which is
 * exactly what it should have been all along.
 *
 * Same two rules as `triage.ts`: this never throws, and it never decides.
 */
import { db } from "@/db";
import type { IssueStatus } from "@/db/schema/enums";

import { generateJson } from "./client";

export type ResolutionPlan = {
  /** What to do next, in order. Three to five items. */
  steps: string[];
  /** One short paragraph addressed to the person who filed the report. */
  citizenUpdate: string;
};

const responseSchema = {
  type: "OBJECT",
  properties: {
    steps: { type: "ARRAY", items: { type: "STRING" } },
    citizenUpdate: { type: "STRING" },
  },
  required: ["steps", "citizenUpdate"],
};

/** What a citizen is owed at each stage. Without this the model writes the same
 *  "we are looking into it" paragraph whatever the status says. */
const STATUS_GUIDANCE: Record<IssueStatus, string> = {
  SUBMITTED: "The report has been received and nobody has looked at it yet. Do not promise a timeline.",
  ACKNOWLEDGED: "An officer has read it and accepted it as real work. Say what happens next, not when it will finish.",
  IN_PROGRESS: "Work has started. Say what is being done now.",
  RESOLVED: "The work is finished. Say what was done, and how to report it again if the problem returns.",
  REJECTED: "The report will not be acted on. Say plainly why, without blaming the reporter, and say where else they can take it.",
};

function buildPrompt(issue: {
  title: string;
  description: string;
  address: string;
  category: string;
  priority: string;
  status: IssueStatus;
  departmentName: string | null;
  ageInDays: number;
}): string {
  return `You are advising an officer of the ${issue.departmentName ?? "municipal"} department in Tezpur, Assam, India, who has just opened this citizen report.

Title: ${issue.title}
Description: ${issue.description}
Location: ${issue.address}
Category: ${issue.category}
Priority: ${issue.priority}
Status: ${issue.status}
Filed: ${issue.ageInDays} day${issue.ageInDays === 1 ? "" : "s"} ago

steps: three to five concrete actions this officer takes next, in order, each one a short imperative sentence. Municipal reality, not project management: inspecting, signposting a hazard, scheduling a crew, notifying another department, photographing the finished work. No step may promise a date.

citizenUpdate: one paragraph of at most 60 words, addressed to the person who filed this report, in plain language a resident reads once and understands. ${STATUS_GUIDANCE[issue.status]}

Never invent a fact that is not above: no dates, no crew names, no budgets, no cause you were not told. If the report is too vague to act on, say the first step is to contact the reporter for detail.`;
}

/**
 * Suggests next actions and a citizen-facing draft, or null.
 *
 * Null when AI is off, when the issue is gone, or when the model fails. The
 * caller renders nothing in that case: a copilot that cannot answer is a
 * section that should not appear.
 */
export async function suggestResolution(
  issueId: string,
): Promise<ResolutionPlan | null> {
  const issue = await db.query.issues.findFirst({
    where: { id: issueId },
    columns: {
      title: true,
      description: true,
      address: true,
      category: true,
      priority: true,
      status: true,
      createdAt: true,
    },
    with: { department: { columns: { name: true } } },
  });
  if (!issue) return null;

  const ageInDays = Math.max(
    0,
    Math.floor((Date.now() - issue.createdAt.getTime()) / 86_400_000),
  );

  const raw = await generateJson<{ steps: unknown; citizenUpdate: unknown }>(
    buildPrompt({
      title: issue.title,
      description: issue.description,
      address: issue.address,
      category: issue.category,
      priority: issue.priority,
      status: issue.status,
      departmentName: issue.department?.name ?? null,
      ageInDays,
    }),
    responseSchema,
  );

  return toPlan(raw);
}

/**
 * Turns whatever the model returned into a plan, or null.
 *
 * Exported for the tests. A response schema constrains the shape but does not
 * guarantee it, and an empty step list rendered as a numbered list of nothing
 * is worse than no section at all.
 */
export function toPlan(raw: {
  steps: unknown;
  citizenUpdate: unknown;
} | null): ResolutionPlan | null {
  if (!raw) return null;

  const steps = Array.isArray(raw.steps)
    ? raw.steps
        .filter((s): s is string => typeof s === "string" && s.trim() !== "")
        .map((s) => s.trim().slice(0, 200))
        .slice(0, 5)
    : [];

  const citizenUpdate =
    typeof raw.citizenUpdate === "string" ? raw.citizenUpdate.trim() : "";

  if (steps.length === 0 || citizenUpdate === "") return null;

  // 2000 is the cap `createCommentSchema` enforces on the way back in, so a
  // draft that cannot be posted is never offered.
  return { steps, citizenUpdate: citizenUpdate.slice(0, 2000) };
}
