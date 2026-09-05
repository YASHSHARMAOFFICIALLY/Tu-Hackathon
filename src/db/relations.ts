/**
 * Relational config for the query API (`db.query.users.findMany({ with: ... })`).
 *
 * Drizzle v1 change worth knowing: the old `drizzle(url, { schema })` option is
 * gone. Relations are no longer declared inside table files with `relations()`;
 * they are declared centrally here from the schema barrel and passed to the
 * client as `{ relations }`. Table files stay pure column definitions.
 *
 * Right now this is the no-argument form, which registers every table with no
 * relations. Add the builder callback as soon as two tables reference each other:
 *
 *   export const relations = defineRelations(schema, (r) => ({
 *     users: { posts: r.many.posts() },
 *     posts: { author: r.one.users({ from: r.posts.authorId, to: r.users.id }) },
 *   }));
 *
 * If this file ever gets crowded, `defineRelationsPart` splits it per domain.
 */
import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  session: {
    user: r.one.user({ from: r.session.userId, to: r.user.id }),
  },
  account: {
    user: r.one.user({ from: r.account.userId, to: r.user.id }),
  },
  user: {
    sessions: r.many.session(),
    accounts: r.many.account(),
    profile: r.one.profiles({ from: r.user.id, to: r.profiles.userId }),
    reportedIssues: r.many.issues({
      from: r.user.id,
      to: r.issues.reportedBy,
    }),
  },
  profiles: {
    user: r.one.user({ from: r.profiles.userId, to: r.user.id }),
    department: r.one.departments({
      from: r.profiles.departmentId,
      to: r.departments.id,
    }),
  },
  departments: {
    issues: r.many.issues({ from: r.departments.id, to: r.issues.departmentId }),
  },
  issues: {
    reporter: r.one.user({ from: r.issues.reportedBy, to: r.user.id }),
    assignee: r.one.user({ from: r.issues.assignedTo, to: r.user.id }),
    department: r.one.departments({
      from: r.issues.departmentId,
      to: r.departments.id,
    }),
    history: r.many.issueHistory({
      from: r.issues.id,
      to: r.issueHistory.issueId,
    }),
    comments: r.many.comments({ from: r.issues.id, to: r.comments.issueId }),
    attachments: r.many.attachments({
      from: r.issues.id,
      to: r.attachments.issueId,
    }),
    // Other reports of the same problem, when this issue is the primary one.
    duplicates: r.many.issueDuplicates({
      from: r.issues.id,
      to: r.issueDuplicates.primaryIssueId,
    }),
  },
  issueHistory: {
    issue: r.one.issues({ from: r.issueHistory.issueId, to: r.issues.id }),
    actor: r.one.user({ from: r.issueHistory.actorId, to: r.user.id }),
  },
  comments: {
    issue: r.one.issues({ from: r.comments.issueId, to: r.issues.id }),
    author: r.one.user({ from: r.comments.authorId, to: r.user.id }),
  },
  attachments: {
    issue: r.one.issues({ from: r.attachments.issueId, to: r.issues.id }),
    uploader: r.one.user({ from: r.attachments.uploadedBy, to: r.user.id }),
  },
  issueDuplicates: {
    primaryIssue: r.one.issues({
      from: r.issueDuplicates.primaryIssueId,
      to: r.issues.id,
    }),
    duplicateIssue: r.one.issues({
      from: r.issueDuplicates.duplicateIssueId,
      to: r.issues.id,
    }),
  },
}));
