/**
 * Shared Postgres enums.
 *
 * Enums over text+CHECK because Drizzle infers a TypeScript union from them, so
 * an invalid role or status fails to compile rather than failing at runtime.
 *
 * The usual objection is that `ALTER TYPE ... ADD VALUE` cannot run inside a
 * transaction — but our migration runner uses the Neon HTTP driver, which never
 * opens one. Adding a value later is an ordinary migration here.
 */
import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Who someone is in the system.
 *
 * CITIZEN  — reports issues, tracks their own (the default for every new user)
 * OFFICER  — acts on issues within their department
 * ADMIN    — everything, including backup export and restore
 */
export const userRole = pgEnum("user_role", ["CITIZEN", "OFFICER", "ADMIN"]);

export type UserRole = (typeof userRole.enumValues)[number];

/**
 * Issue lifecycle. The brief names these four explicitly:
 * "updates statuses such as Submitted, Acknowledged, In Progress and Resolved".
 *
 * REJECTED is ours — an authority needs a way to close an invalid report
 * without deleting it, since the brief forbids silently destroying reports.
 */
export const issueStatus = pgEnum("issue_status", [
  "SUBMITTED",
  "ACKNOWLEDGED",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
]);

export type IssueStatus = (typeof issueStatus.enumValues)[number];

/** Priority, set by an authorised user after triage ("Priority level" on the MVP list). */
export const issuePriority = pgEnum("issue_priority", [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);

export type IssuePriority = (typeof issuePriority.enumValues)[number];

/**
 * Issue category, chosen by the citizen at submission time ("Location and
 * category" on the MVP list). Also one of the three signals used by the
 * pre-submit duplicate check.
 */
export const issueCategory = pgEnum("issue_category", [
  "ROADS",
  "WATER_SUPPLY",
  "ELECTRICITY",
  "SANITATION",
  "PUBLIC_SAFETY",
  "OTHER",
]);

export type IssueCategory = (typeof issueCategory.enumValues)[number];

/**
 * What happened to an issue. Every entry in `issue_history` carries one, so the
 * public timeline can render assignments and priority changes, not just status
 * moves — the brief asks for "status history" and "public progress updates".
 */
export const issueEvent = pgEnum("issue_event", [
  "CREATED",
  "STATUS_CHANGED",
  "ASSIGNED",
  "PRIORITY_CHANGED",
  "DEPARTMENT_CHANGED",
  "DUPLICATE_LINKED",
  "COMMENTED",
]);

export type IssueEvent = (typeof issueEvent.enumValues)[number];
