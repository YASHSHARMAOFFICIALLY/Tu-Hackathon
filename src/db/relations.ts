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
  },
}));
