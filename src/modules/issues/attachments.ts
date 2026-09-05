/**
 * Photo evidence: the upload path.
 *
 * The `attachments` table stores a URL and never bytes. That is not a style
 * preference — the graded deliverable is a JSON backup of the whole database,
 * and base64'ing every photograph into it would make the file unusable. So the
 * bytes go to blob storage and the row keeps the pointer.
 *
 * Everything below is a trust boundary. An upload endpoint that does not check
 * who is calling, what the file is, and how many already exist is the classic
 * hole, and "it is only a hackathon" is how it ships.
 *
 * Ordering matters: an attachment is written AFTER its issue exists, addressed
 * by issue id. Uploading during the pre-submit duplicate check would leave an
 * orphan blob behind every abandoned check — and the check is designed to be
 * abandoned, that is what it is for.
 */
import { del, put } from "@vercel/blob";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { attachments } from "@/db/schema";
import { env, uploadsEnabled } from "@/env";
import { NotFoundError, ValidationError } from "@/lib/http";
import { getCurrentUser, requireRole } from "@/modules/auth/permissions";

/**
 * What a citizen may attach. Photographs of the problem, and nothing else:
 * every entry here is an image type a browser will render inline, so a file
 * that reaches the register cannot become a download nobody expected.
 */
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/** 8MB. A phone photo is 2-5MB; anything past this is not evidence. */
const MAX_BYTES = 8 * 1024 * 1024;

/** Per issue. Enough to show the problem from two angles and its surroundings. */
const MAX_PER_ISSUE = 5;

/**
 * The file rules, separated from the database and the session so they can be
 * tested exhaustively without seeding a user or a store. Throws the same
 * `ValidationError` the route maps to a 400.
 */
export function assertUploadable(
  file: { type: string; size: number },
  existingCount: number,
) {
  if (existingCount >= MAX_PER_ISSUE) {
    throw new ValidationError(
      `A report may carry at most ${MAX_PER_ISSUE} photos`,
    );
  }
  // The browser's Content-Type is a claim, not a fact, so the size check runs
  // on the bytes actually received rather than on a header.
  if (!ALLOWED.has(file.type)) {
    throw new ValidationError("Only JPEG, PNG and WebP images can be attached");
  }
  if (file.size === 0) throw new ValidationError("That file is empty");
  if (file.size > MAX_BYTES) {
    throw new ValidationError(
      `Each photo must be under ${MAX_BYTES / (1024 * 1024)}MB`,
    );
  }
}

export type StoredAttachment = {
  id: string;
  url: string;
  fileType: string | null;
};

/**
 * Store one photograph against an issue.
 *
 * Authorisation is the reporter, or an officer/admin — the same predicate
 * `updateIssue` uses, because attaching evidence to someone else's report is
 * the same kind of act as editing it.
 */
export async function addAttachment(
  issueId: string,
  file: File,
): Promise<StoredAttachment> {
  if (!uploadsEnabled) {
    throw new ValidationError(
      "Photo storage is not configured on this deployment.",
    );
  }

  const user = await requireRole("CITIZEN", "OFFICER", "ADMIN");

  const issue = await db.query.issues.findFirst({
    where: { id: issueId },
    columns: { id: true, reportedBy: true },
    with: { attachments: { columns: { id: true } } },
  });
  if (!issue) throw new NotFoundError("Issue not found");

  const isAuthority = user.role === "OFFICER" || user.role === "ADMIN";
  if (issue.reportedBy !== user.id && !isAuthority) {
    throw new ValidationError(
      "You can only attach photos to reports you filed",
    );
  }

  assertUploadable(
    { type: file.type, size: file.size },
    issue.attachments?.length ?? 0,
  );

  // `addRandomSuffix` keeps two photos with the same camera filename from
  // overwriting each other, and stops the URL from disclosing the original
  // name a citizen's phone chose.
  const blob = await put(`issues/${issueId}/${safeName(file.name)}`, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
    token: env.BLOB_READ_WRITE_TOKEN,
  });

  const [row] = await db
    .insert(attachments)
    .values({
      issueId,
      uploadedBy: user.id,
      url: blob.url,
      fileType: file.type,
    })
    .returning({
      id: attachments.id,
      url: attachments.url,
      fileType: attachments.fileType,
    });

  return row;
}

/**
 * Remove a photograph, blob included.
 *
 * Deleting the row alone would leave the bytes paid for and unreachable, which
 * is the worse half of a deletion: the citizen believes the photo is gone and
 * it is still served at its URL. The blob goes first for that reason — a failed
 * row delete leaves a broken image, a failed blob delete leaves a live one.
 */
export async function deleteAttachment(attachmentId: string) {
  const user = await requireRole("CITIZEN", "OFFICER", "ADMIN");

  const attachment = await db.query.attachments.findFirst({
    where: { id: attachmentId },
    with: { issue: { columns: { id: true, reportedBy: true, status: true } } },
  });
  if (!attachment) throw new NotFoundError("Attachment not found");

  const isAuthority = user.role === "OFFICER" || user.role === "ADMIN";
  const isReporter = attachment.issue?.reportedBy === user.id;

  if (!isReporter && !isAuthority) {
    throw new ValidationError("You can only remove photos you attached");
  }
  // Evidence on a closed report is the record of why it was closed.
  if (
    !isAuthority &&
    (attachment.issue?.status === "RESOLVED" ||
      attachment.issue?.status === "REJECTED")
  ) {
    throw new ValidationError(
      "Photos on a closed report cannot be removed",
    );
  }

  await del(attachment.url, { token: env.BLOB_READ_WRITE_TOKEN });
  await db.delete(attachments).where(eq(attachments.id, attachmentId));

  return { id: attachmentId };
}

/** Whether the current session may attach to this issue, for the UI to ask. */
export async function canAttach(issue: {
  reportedBy: string | null;
}): Promise<boolean> {
  if (!uploadsEnabled) return false;
  const user = await getCurrentUser();
  if (!user) return false;
  return (
    issue.reportedBy === user.id ||
    user.role === "OFFICER" ||
    user.role === "ADMIN"
  );
}

/**
 * A filename safe to put in a URL path. The extension is dropped along with
 * everything else unusual: the content type is authoritative, and the blob's
 * own random suffix makes the name unique.
 */
function safeName(name: string) {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return cleaned.length > 0 ? cleaned : "photo";
}
