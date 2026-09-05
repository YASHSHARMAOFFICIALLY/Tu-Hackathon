/**
 * HTTP plumbing for route handlers.
 *
 * Services throw typed errors and know nothing about HTTP; this file is the one
 * place that turns them into status codes. That split is what lets the backup
 * module (Phase 7) reuse the same services without dragging Request/Response
 * through them.
 */
import { ZodError } from "zod";

import { ForbiddenError, UnauthorizedError } from "@/modules/auth/permissions";

/** Thrown when a resource does not exist (or the caller may not know it does). */
export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Thrown for business-rule violations — an illegal status transition, say. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Wraps a route handler so every known error maps to a status code and an
 * unknown one never leaks a stack trace to the client.
 */
export async function handle(
  fn: () => Promise<Response>,
): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof NotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ZodError) {
      // Field-level detail so the client can highlight the offending input.
      return Response.json(
        {
          error: "Invalid request",
          issues: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }

    // Unexpected: log server-side, tell the client nothing useful to an attacker.
    console.error("Unhandled route error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Parses a JSON body, turning malformed JSON into a 400 rather than a 500. */
export async function jsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}
