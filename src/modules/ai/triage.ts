/**
 * AI Civic Triage.
 *
 * Turns a citizen's free-text complaint into structured suggestions an officer
 * can accept or override: category, priority, department, a short summary, and
 * a confidence score.
 *
 * TWO RULES, both load-bearing:
 *
 * 1. This never throws. Every failure path returns null, and the caller keeps
 *    the issue exactly as the citizen filed it. A hazard report must not depend
 *    on a model provider being up.
 * 2. These are SUGGESTIONS. They are stored in ai_* columns beside the real
 *    fields, never instead of them. An officer decides.
 */
import { db } from "@/db";
import { departments } from "@/db/schema";
import type { IssueCategory, IssuePriority } from "@/db/schema/enums";
import { issueCategory, issuePriority } from "@/db/schema/enums";

import { fetchInlineImage, generateJson, type InlineImage } from "./client";

export type TriageResult = {
  category: IssueCategory;
  priority: IssuePriority;
  priorityScore: number;
  departmentName: string | null;
  summary: string;
  reasoning: string;
  confidence: number;
  /** How many photos the model actually read. Zero when there were none, when
   *  they could not be fetched, or when AI is off. The panel only claims the
   *  photos were read when this is above zero. */
  photoCount: number;
};

/**
 * At most three photos per call.
 *
 * Not a token-cost decision: the third photo of a pothole adds nothing a triage
 * officer would weigh, and each one is a fetch that can hang. `assertUploadable`
 * caps an issue at five.
 */
const MAX_PHOTOS = 3;

/**
 * Reads up to `MAX_PHOTOS` of an issue's photos into inline bytes.
 *
 * Sequential rather than parallel: three 8MB downloads at once, from a route
 * that is already fire-and-forget background work, is a spike with nothing
 * waiting on it. Failures are dropped, never thrown.
 */
async function readPhotos(urls: string[]): Promise<InlineImage[]> {
  const images: InlineImage[] = [];
  for (const url of urls.slice(0, MAX_PHOTOS)) {
    const image = await fetchInlineImage(url);
    if (image) images.push(image);
  }
  return images;
}

/**
 * Response schema handed to Gemini. Constraining the output at the API level is
 * cheaper and more reliable than parsing prose and hoping.
 */
function responseSchema(departmentNames: string[]) {
  return {
    type: "OBJECT",
    properties: {
      category: { type: "STRING", enum: [...issueCategory.enumValues] },
      priority: { type: "STRING", enum: [...issuePriority.enumValues] },
      priorityScore: { type: "INTEGER" },
      department: { type: "STRING", enum: departmentNames },
      summary: { type: "STRING" },
      reasoning: { type: "STRING" },
      confidence: { type: "INTEGER" },
    },
    required: [
      "category", "priority", "priorityScore", "department",
      "summary", "reasoning", "confidence",
    ],
  };
}

/** Exported for the tests: the photo clause is the branch worth asserting, and
 *  asserting it must not cost a live model call. */
export function buildPrompt(
  input: { title: string; description: string; address: string },
  departmentNames: string[],
  photoCount: number,
): string {
  // Deliberately concrete about what "priority" means here. Without these
  // anchors a model rates almost everything MEDIUM, which is useless for triage.
  return `You are a triage officer for a municipal public-issue tracker in Tezpur, Assam, India.

Classify this citizen complaint.

Title: ${input.title}
Description: ${input.description}
Location: ${input.address}

Available departments: ${departmentNames.join(", ")}

Priority guidance:
- CRITICAL (85-100): immediate danger to life — exposed live wires, sparking transformers, collapsing structures, open manholes on busy roads.
- HIGH (60-84): serious safety or health risk, or many people affected — sewage entering homes, no water for days, unlit road at an accident spot.
- MEDIUM (30-59): real disruption but no immediate danger — a single broken street light, uncollected garbage, a small pothole.
- LOW (0-29): cosmetic or minor inconvenience — faded paint, an untidy verge.

Weigh: severity, how many people are affected, safety risk, proximity to schools or hospitals, and how long it has gone unresolved.

summary: at most two sentences, written for a busy officer.
reasoning: one sentence explaining the priority score.
confidence: 0-100, how certain you are of this classification. Be honest — a vague complaint deserves a low score.${
    photoCount > 0
      ? `

${photoCount} photograph${photoCount === 1 ? "" : "s"} taken by the reporter ${photoCount === 1 ? "is" : "are"} attached. Judge severity from what you can actually see in ${photoCount === 1 ? "it" : "them"}, and say so in one clause of your reasoning. If a photograph contradicts the description, trust the photograph and note the difference. If you cannot make out the problem, say that instead of guessing.`
      : ""
  }`;
}

export async function triageIssue(input: {
  title: string;
  description: string;
  address: string;
  /** Blob URLs of the reporter's photos, newest last. Empty for a text-only
   *  report, and for every report filed while uploads were disabled. */
  photoUrls?: string[];
}): Promise<TriageResult | null> {
  const departmentRows = await db
    .select({ name: departments.name })
    .from(departments);

  if (departmentRows.length === 0) return null;
  const names = departmentRows.map((d) => d.name);

  const images = await readPhotos(input.photoUrls ?? []);

  const raw = await generateJson<{
    category: string;
    priority: string;
    priorityScore: number;
    department: string;
    summary: string;
    reasoning: string;
    confidence: number;
  }>(buildPrompt(input, names, images.length), responseSchema(names), images);

  if (!raw) return null;

  // Never trust the model's output shape, even with a response schema: a value
  // outside our enums must degrade to null, not corrupt a row.
  const category = issueCategory.enumValues.find((c) => c === raw.category);
  const priority = issuePriority.enumValues.find((p) => p === raw.priority);
  if (!category || !priority) return null;

  const clamp = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n)
      ? Math.min(100, Math.max(0, Math.round(n)))
      : 0;

  return {
    category,
    priority,
    priorityScore: clamp(raw.priorityScore),
    departmentName: names.includes(raw.department) ? raw.department : null,
    summary: String(raw.summary ?? "").slice(0, 500),
    reasoning: String(raw.reasoning ?? "").slice(0, 500),
    confidence: clamp(raw.confidence),
    photoCount: images.length,
  };
}
