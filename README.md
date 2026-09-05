# Public Issue Resolution Tracker

Citizens report public issues; authorities triage, assign and resolve them; the
public follows progress. Built for **TEZHACK 2026** — Team CUCKOO (ID 69),
problem **WEB03**, challenge **WEB-C16 (Backup and Restore)**.

**Live:** https://tu-hackathon.vercel.app

**Stack:** Next.js 16 (App Router) · TypeScript · Drizzle ORM v1 · Neon Postgres
· Better Auth (Google) · Tailwind v4 · Bun

---

## Quick start

```bash
bun install
cp .env.example .env.local          # then fill in the values below
bun run db:migrate                  # create the schema
bun run db:seed:departments         # 5 departments
bun run db:seed:demo                # ~50 realistic issues (optional)
bun dev
```

Sign in at `/sign-in`, then make yourself an admin:

```bash
bun run db:admin you@example.com    # you must have signed in at least once
```

### Environment variables

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | Neon Console → your project → Connection Details (pooled string) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `http://localhost:3000` locally; the real origin in production |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web) |

Google's **Authorised redirect URI** must be exactly:

```
http://localhost:3000/api/auth/callback/google
```

---

## Scripts

| Command | Does |
|---|---|
| `bun dev` | Next dev server |
| `bun run build` | Production build (also regenerates typed routes) |
| `bun run lint` | ESLint |
| `bun run test` | Unit tests — destructive backup tests are skipped |
| `bun run test:backup` | ⚠️ **Wipes** the database in `DATABASE_URL`, then round-trips it |
| `bun run db:generate` | Write a migration from schema changes |
| `bun run db:migrate` | Apply pending migrations |
| `bun run db:check` | Fail if schema and migrations disagree |
| `bun run db:studio` | Browse the database |
| `bun run db:admin <email>` | Promote a signed-in user to ADMIN |
| `bun run db:seed:departments` | Seed the 5 departments (idempotent) |
| `bun run db:seed:demo` | Seed ~50 demo issues (deterministic, re-runnable) |

---

## Project layout

```
src/
  app/            routes only — thin, no business logic
    api/
  lib/http.ts     errors → status codes
  db/             INFRASTRUCTURE: clients, relations, migrations, shared enums
  modules/        FEATURE MODULES — each owns its tables, services and tests
    auth/         Better Auth, sessions, roles, permissions
    departments/
    issues/       schema, services, workflow, duplicate search, serialisation
    dashboard/
    backup/       export, validation, restore  ← the graded challenge
```

Two rules keep this working with several contributors:

1. **A module owns its tables.** New table → new file in
   `src/modules/<feature>/schema/`, then re-export it from
   `src/db/schema/index.ts` or drizzle-kit will not see it.
2. **Services never touch `Request`/`Response`.** Routes translate HTTP;
   services own the rules. That is what lets the backup module reuse them.

---

## API

### Public

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/issues` | filtered, paginated (`status`, `category`, `priority`, `departmentId`, `mine`, `assigned=me`, `limit`, `offset`) |
| `GET` | `/api/issues/:id` | issue + timeline |
| `GET` | `/api/public/issues/:number` | track by the reference number a citizen was given |

### Signed in

| Method | Path | Role |
|---|---|---|
| `GET` | `/api/me` | any |
| `POST` | `/api/issues` | CITIZEN+ |
| `POST` | `/api/issues/check-duplicates` | CITIZEN+ — call before creating |
| `PATCH` | `/api/issues/:id` | reporter or ADMIN |
| `POST` | `/api/issues/:id/comments` | CITIZEN+ (internal notes: OFFICER+) |
| `PATCH` | `/api/issues/:id/status` | OFFICER+ |
| `PATCH` | `/api/issues/:id/assign` | OFFICER+ |
| `PATCH` | `/api/issues/:id/priority` | OFFICER+ |
| `POST` | `/api/issues/:id/triage` | OFFICER+ (accept or modify AI suggestions) |
| `POST` | `/api/issues/:id/attachments` | reporter or OFFICER+ |
| `DELETE` | `/api/issues/:id/attachments/:attachmentId` | reporter or OFFICER+ |
| `POST`/`DELETE` | `/api/issues/:id/duplicates` | OFFICER+ |
| `GET` | `/api/dashboard` | OFFICER+ |
| `GET` | `/api/admin/backup/export` | ADMIN |
| `POST` | `/api/admin/backup/preview` | ADMIN |
| `POST` | `/api/admin/backup/restore` | ADMIN |

Officers act only on issues in their own department; an untriaged issue (no
department yet) is open to any officer.

---

## Backup and restore (WEB-C16)

```bash
# export
curl -b cookies.txt http://localhost:3000/api/admin/backup/export -o backup.json

# preview — validates, writes nothing
curl -b cookies.txt -X POST http://localhost:3000/api/admin/backup/preview \
  -H 'content-type: application/json' --data-binary @backup.json

# restore into an empty database
curl -b cookies.txt -X POST 'http://localhost:3000/api/admin/backup/restore' \
  -H 'content-type: application/json' --data-binary @backup.json
```

**What is never exported:** `account` (live Google access/refresh tokens),
`session`, `verification`, `rate_limit`. The backup carries **zero credentials**
and still restores a working app — users keep their original ids so every
foreign key resolves, and they re-link to Google by verified email on their next
sign-in.

`?redactEmails=true` replaces emails with stable hashed placeholders when the
file has to leave trusted hands.

`?mode=replace` wipes and restores inside one transaction. The default,
`empty-only`, refuses a database that already holds issues.

### The empty copy for the demo

Use a Neon branch rather than deleting anything:

1. Neon Console → your project → **Branches** → **New branch** from `main`
2. Connect to it and run `bun run db:migrate` (schema only, no data)
3. Point `DATABASE_URL` at the branch and restore `backup.json` into it

Your working database is never touched, and the branch is a genuinely empty
copy — which is exactly what the challenge asks for.

---

## Deploy

Production runs on Vercel and the project is already linked
(`.vercel/project.json`), so these run from the repo root with no setup:

```bash
vercel                # preview URL, safe to test
vercel --prod         # production: https://tu-hackathon.vercel.app
vercel ls             # recent deployments
vercel logs <url>     # runtime logs
vercel rollback       # roll production back one deploy
```

**The CLI uploads the working directory, not a git ref.** Whatever is in the
folder ships, committed or not, pushed or not. That is the point when you want
a deploy without touching GitHub, and the trap when you have an experiment
open: use bare `vercel` for a preview if you are not certain.

Environment variables live in the Vercel project, not in the repo, and a change
to one needs a redeploy to take effect:

```bash
vercel env ls production
vercel env add GEMINI_API_KEY production
```

`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` are set in production. **`GEMINI_API_KEY` is not**, so
the live site runs with AI triage and semantic duplicate matching off. The
rule-based duplicate check (category, ~1km, trigram) still runs, which is the
fallback that path was built for.

---

## Testing

```bash
bun run test          # fast, safe, runs on every change
bun run test:backup   # DESTRUCTIVE — point DATABASE_URL at a branch first
```

`test:backup` is the WEB-C16 claim in executable form: export → wipe → restore →
every row, id and relationship verified, plus two rollback paths (a corrupt
reference caught before any write, and a constraint violation caught mid-INSERT
that rolls the whole restore back).
