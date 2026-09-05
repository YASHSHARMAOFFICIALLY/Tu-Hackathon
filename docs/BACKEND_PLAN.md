# Backend Plan — Public Issue Resolution Tracker

**Event:** TEZHACK 2026 · Team CUCKOO (ID 69) · Track: Web
**Problem:** WEB03 — Public Issue Resolution Tracker
**Challenge:** WEB-C16 — Backup and Restore
**Budget: 48 hours.** The brief says "EXPECTED 48-HOUR MVP" — scope every
decision against that, not against what would be nice to own afterwards.


---

## 0. START HERE — next session (frontend)

**Backend is complete: Phases 0–9.** Nine commits on branch `auth`, all green:
`bunx tsc --noEmit`, `bun run lint`, `bun run db:check`, `bun test`
(38 pass + 5 destructive skipped), `bun run test:backup` (15 pass),
`bun run build`.

### Get running in one minute

```bash
bun install
bun run db:migrate            # schema is already applied on the current DB
bun run db:seed:departments   # idempotent
bun run db:seed:demo          # ~50 issues, deterministic
bun dev
```

### ⛔ Three things still blocked on the user

1. **Google OAuth credentials** — `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in
   `.env.local` are still `placeholder`, so **no end-to-end login has ever run**.
   Redirect URI must be exactly `http://localhost:3000/api/auth/callback/google`.
   Then: sign in once → `bun run db:admin <email>` → you are ADMIN.
2. **`git push` fails** — nine commits queued. Not a repo problem (1 MB, reads
   work): uploads are cut on both HTTPS and SSH. Retry on another network, then
   `gh pr create --fill`.
3. **Neon `demo-restore` branch** — see the NEXT SESSION note in §9.

Optional: `GEMINI_API_KEY` (free, aistudio.google.com/apikey) then
`bun run ai:backfill` to triage and embed the seeded issues. Everything works
without it, minus AI suggestions.

### ⚠️ Do not run `bun run test:backup` against a database you care about

It wipes every product table. It has already eaten the seed data twice — re-seed
with `db:seed:departments` + `db:seed:demo` afterwards.

### Phase 10 — Frontend (next session)

The user deliberately deferred all UI: *"for frontend keep simple later i will
change, backend is more focus now"*. `brand.md` is `Status: deferred`, so the
design skills will use stock neutral tokens and will not prompt again. Run
`/brand-design` first if a real palette is wanted.

Every page below is a thin client over an API that already exists and is tested.

| Page | Route | API it consumes |
|---|---|---|
| Home / issue list | `/` | `GET /api/issues` |
| Report an issue | `/report` | `POST /api/issues/check-duplicates` **as they type**, then `POST /api/issues` |
| Issue detail + timeline | `/issues/:id` | `GET /api/issues/:id` |
| Public tracking | `/track/:number` | `GET /api/public/issues/:number` |
| My reports | `/my-issues` | `GET /api/issues?mine=true` |
| Officer queue | `/officer` | `GET /api/issues?status=...`, the workflow PATCHes |
| Issue triage panel | `/officer/issues/:id` | `POST /api/issues/:id/triage`, status/assign/priority |
| Authority dashboard | `/admin` | `GET /api/dashboard` |
| **Backup & restore** | `/admin/backup` | export → preview → restore |

**`/admin/backup` is the screen the judges actually watch.** It needs: an export
button that downloads the file, a drop zone, a preview showing row counts and
the format version, a confirm step, and — most importantly — a visible error
state, because demoing a REJECTED corrupt backup with the database untouched is
the strongest 20 seconds in the whole presentation.

Two UI details worth not losing:
- The duplicate check runs **before** submission and returns `matchedBy`
  (`text` / `meaning` / `both`). Showing "matched by meaning" is where the AI
  becomes visible to a judge.
- AI suggestions must render as *suggestions* with an Accept / Modify control,
  never as decisions already applied.

---

## 1. The official brief (verbatim)

Transcribed from the TEZHACK 2026 team-allocation page and the WEB03 card.
This is the source of truth; where anything below disagrees with it, this
section wins.

### WEB03 — Public Issue Resolution Tracker

> Citizens may submit repeated complaints without knowing whether the
> responsible authority has received, assigned or resolved them. Develop a
> portal that records issues, identifies possible duplicates and provides
> public progress updates.

### Expected 48-hour MVP

The brief lists exactly eight items. This is the grading checklist:

- [ ] Complaint submission
- [ ] Location and category
- [ ] Possible duplicate grouping
- [ ] Department assignment
- [ ] Priority level
- [ ] Status history
- [ ] Public tracking
- [ ] Authority dashboard

### Build goal

> Allow citizens to report public issues and follow their progress while
> authorities organise repeated reports. Suggested roles are Citizen and
> Department Officer or Administrator.

### Required flow

> A citizen submits an issue with category, location, description and optional
> evidence. **The system should show possible existing reports before creating a
> duplicate.** An authorised user assigns the department and priority, then
> updates statuses such as Submitted, Acknowledged, In Progress and Resolved.

### Important rules

> - Duplicate reports should be **grouped or linked, not silently deleted**.
> - Resolution should **include a note or evidence**.
> - **Personal information must remain private.**
> - Real municipal integration is not required.

### WEB-C16 — Backup and Restore (the graded challenge)

> Allow an authorised user to export project records as JSON and restore them
> into an empty copy of the app.

**How it will be checked:**

> Export sample records, clear or use a fresh copy, import them and verify the
> restored data.

---

## 1a. What the brief changes vs. our earlier assumptions

Four corrections, all from the official text:

1. **Duplicate detection runs BEFORE submission.** The citizen sees "possible
   existing reports" while filling the form and can attach to one instead of
   creating a new issue. This is a search endpoint on the create path, not an
   officer-side cleanup tool. It also implies duplicates are found by
   **category + location + text**, since that is all the form has at that point.
2. **Duplicates are linked, never deleted.** A hard delete of a duplicate is an
   explicit rule violation. `issue_duplicates` links; nothing is destroyed.
3. **Resolution requires a note or evidence.** Moving an issue to RESOLVED with
   an empty note must be rejected by the service layer, not merely discouraged
   in the UI.
4. **Personal information must remain private.** This has two consequences that
   are easy to miss:
   - Public endpoints must never return reporter name, email, or exact home
     location. Return a display handle and a coarse location.
   - **The JSON backup contains user emails.** Export is ADMIN-only and the file
     is PII. Decide deliberately (see §6) whether the export redacts emails or
     is simply treated as a privileged artifact. Say which, and why, to the
     judges — this rule is on their checklist.

### MVP checklist → phase map

| Brief item | Phase |
|---|---|
| Complaint submission | 4 |
| Location and category | 2, 4 |
| Possible duplicate grouping | 4 (pre-submit search) + 5 (linking) |
| Department assignment | 2, 5 |
| Priority level | 2, 5 |
| Status history | 3, 5 |
| Public tracking | 4, 6 |
| Authority dashboard | 6 |
| **Backup and Restore (WEB-C16)** | **7** |

---

## 2. What already exists (verified, not assumed)

Branch `auth`. Phases 0 and 1 complete; module restructure applied.

```
src/
  env.ts                       fail-fast env access
  middleware.ts                cookie-presence redirect (NOT authorization)
  app/
    sign-in/page.tsx           plain sign-in page, validates ?redirectTo
    api/me/route.ts            401 anonymous, narrow payload
    api/issues/route.ts        GET list (public, filtered, paginated) · POST create
    api/issues/[id]/route.ts   GET one + timeline · PATCH own report
    api/issues/[id]/comments/  POST comment (internal notes officer-only)
    api/issues/check-duplicates/  POST pre-submit duplicate search
    api/issues/[id]/status/    PATCH lifecycle transition (note required to close)
    api/issues/[id]/assign/    PATCH officer and/or department
    api/issues/[id]/priority/  PATCH triage priority
    api/issues/[id]/duplicates/ POST link · DELETE unlink (link only, never the issue)
    api/issues/[id]/triage/    POST accept or override AI suggestions (OFFICER+)
    api/dashboard/route.ts     GET authority aggregates (OFFICER/ADMIN)
    api/admin/backup/export/   GET  download JSON (ADMIN, ?redactEmails=true)
    api/admin/backup/preview/  POST validate + row counts, writes nothing
    api/admin/backup/restore/  POST restore (ADMIN, ?mode=empty-only|replace)
    api/public/issues/[number]/ GET public tracking by issue number, always public shape
    api/auth/[...all]/         Better Auth handler
  components/auth/             unstyled Google button
  lib/http.ts                  error → status mapping, JSON body parsing
  db/                          INFRASTRUCTURE ONLY — owns no tables
    client.ts                  neon-http — fast, NO transactions
    pool.ts                    neon-serverless WebSocket — HAS transactions
    relations.ts               defineRelations (drizzle v1)
    migrate.ts                 migration runner
    migrations/                9 applied, committed
    schema/
      index.ts                 barrel — re-exports every module's tables
      columns.ts               primaryId(), timestamps
      enums.ts                 shared enums (user_role)
  modules/                     FEATURE MODULES — each owns its tables + logic
    backup/
      format.ts                FORMAT_VERSION, zod schemas, TABLE_ORDER, NEVER_EXPORTED
      export.ts                reads product tables, optional email redaction
      validate.ts              shape → types → referential graph, + migration seam
      restore.ts               ONE transaction, FK order, empty-only | replace
      export.test.ts           redaction asserted on serialized JSON
      roundtrip.test.ts        export→wipe→restore + rollback (opt-in, destructive)
      migration.test.ts        v1 backup imports on the v2 schema
    ai/
      client.ts                Gemini REST (fetch, 12s timeout), never throws
      triage.ts                category/priority/department/summary/confidence
      enrich.ts                post-commit triage + embedding writeback
      backfill.ts              bun run ai:backfill — seeded/restored issues
      triage.test.ts           asserts AI stays optional with no API key
    dashboard/
      service.ts               one-round-trip aggregates (FILTER, not N queries)
    departments/
      schema/departments.ts    id, name (unique), description
      seed.ts                  bun run db:seed:departments (idempotent)
    issues/
      service.ts               createIssue, listIssues, getIssue, updateIssue, addComment
      duplicates.ts            pre-submit search (category + ~1km box + trigram)
      workflow.ts              PURE state machine + resolution-note rule
      workflow.service.ts      status/assign/priority/link — each with its history row
      workflow.test.ts         12 tests, exhaustive transition matrix
      serialize.ts             PRIVACY BOUNDARY: toPublicIssue / toAuthorityIssue
      validation.ts            zod schemas for every input
      serialize.test.ts        7 tests asserting no PII in public payloads
      schema/issues.ts         core record + number, location, status, priority
      schema/issue-history.ts  APPEND-ONLY timeline (event, old/new status+priority)
      schema/comments.ts       public + internal (is_internal) comments
      schema/attachments.ts    evidence URLs, never bytes
      schema/issue-duplicates.ts  links, never deletes; CHECK forbids self-link
    auth/
      index.ts                 Better Auth server instance
      client.ts                browser client
      session.ts               getSession(), requireSession()
      permissions.ts           getCurrentUser(), hasRole(), requireRole/Admin/Officer
      seed-admin.ts            bun run db:admin <email>
      schema/auth.ts           GENERATED: user, session, account, verification, rate_limit
      schema/profiles.ts       role, displayName, timestamps (PK = auth user id)
      auth.test.ts             3 tests
      permissions.test.ts      4 tests — full role matrix
.github/workflows/ci.yml       typecheck, lint, drizzle check, test → gated migrate
```

**Live tables on Neon:** `account`, `departments` (5 seeded), `issues`,
`profiles` (role + department_id), `rate_limit`, `session`, `user`,
`verification`.
**Also live:** `issue_history`, `comments`, `attachments`, `issue_duplicates`.
**Enums:** `user_role`, `issue_status`, `issue_priority`, `issue_category`,
`issue_event`.
**Extension:** `pg_trgm` (trigram index on `issues.title` for duplicate search).

**Green:** `bunx tsc --noEmit`, `bun run lint`, `bun run db:check`,
`bun test` (38 passing + 5 destructive skipped), `bun run test:backup` (15 passing),
`bun run build`.

**Blocked:** `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are still
`placeholder`, so task 0.1 and 0.3 (first real login) are not done.

### Standing conventions

These are already true of the code. Keep them.

- **Feature modules own their tables.** A module is `src/modules/<feature>/`
  containing its `schema/`, services, permissions, and tests. `src/db/` is
  infrastructure and owns no tables.
- **The schema barrel (`src/db/schema/index.ts`) re-exports every module's
  tables.** A table missing from the barrel is invisible to drizzle-kit and will
  be silently left out of migrations.
- **Schema files import only drizzle and other schema files** — never a service,
  which would cycle back through the db client.
- **One file per table.** New table = new file inside its module.
- **Explicit snake_case column names.** drizzle-kit v1 does not auto-convert.
- **`pgTable`'s third argument is an array** in drizzle v1, not an object.
- **Migrations are generated, reviewed as SQL, and committed.** Never `push`.
- **Two database clients, chosen per workload:** `db` (HTTP) for queries,
  `dbPool` (WebSocket) only where a transaction is required.
- **`requireSession()` / `requireRole()` are the authorization boundary.**
  Middleware is a redirect and validates nothing.
- **Never fail open.** A missing profile row resolves to CITIZEN, the least
  privileged role.

### Scripts

| Command | Does |
|---|---|
| `bun dev` | Next dev server |
| `bun run db:generate` | write a migration from schema changes |
| `bun run db:migrate` | apply pending migrations |
| `bun run db:check` | fail if schema and migrations disagree |
| `bun run db:studio` | browse the database |
| `bun run db:admin <email>` | promote a signed-in user to ADMIN |
| `bun run db:seed:departments` | seed the 5 departments (idempotent) |
| `bun run db:seed:demo` | ~50 realistic demo issues (deterministic, re-runnable) |
| `bun run ai:backfill` | triage + embed issues that have none (seeded/restored) |
| `bun run test` | bun test — destructive backup tests SKIPPED |
| `bun run test:backup` | ⚠️ WIPES the database in DATABASE_URL, then round-trips it |

---

## 3. Architecture

```
              Route Handler  (src/app/api/**)
                    │   parse + validate input, map errors to HTTP
                    ▼
              Service layer  (src/services/**)
                    │   business rules, permission checks, transitions
                    ▼
              Drizzle        (src/db/**)
                    │
                    ▼
              Neon Postgres
```

Route handlers stay thin: they never contain business rules. Services never
touch `Request`/`Response`. This split is what makes Phase 7 possible — the
backup module calls the same services, not duplicated SQL.

---

## 4. Data model

Existing (`user`, `profiles`) plus six new tables:

```
user (auth-owned)
 └── profiles          role, department, product data
departments
issues                 the core record
 ├── issue_history     every state change, append-only
 ├── comments
 ├── attachments       file URLs, never binaries
 └── issue_duplicates  master ↔ duplicate links
```

### Decisions to make before writing Phase 2

- **Enums vs text+CHECK for `status`/`priority`.** Recommendation: `pgEnum`.
  Drizzle infers a union type, so an invalid status fails at compile time.
  Normally the catch is that `ALTER TYPE ... ADD VALUE` cannot run inside a
  transaction — but our migrator uses the HTTP driver, which never opens one,
  so adding a status later is a plain migration. The driver choice makes this
  free.
- **Human-facing issue number.** UUID primary keys are right for security, but
  "Issue #1024" reads better than a UUID in a demo. Recommendation: keep
  `id uuid` as the PK and add `number bigserial UNIQUE` for display.
- **Officer scope.** Does an OFFICER act only within `profiles.department_id`,
  or on anything assigned to them? This changes every permission check.
  Recommendation: department-scoped, since departments are already in the model.

---

## 5. Phases

Each task is small on purpose: one sitting, one commit, one reviewable diff.
"Done when" is the check — if it can't be demonstrated, the task isn't done.

**48-hour triage.** Every phase is tagged:

- 🔴 **MUST** — on the brief's MVP checklist or the graded challenge. Cut nothing here.
- 🟡 **SHOULD** — makes the demo credible.
- 🟢 **STRETCH** — only if everything red and yellow is green.

Rough budget: Phase 0–3 in the first ~10h, Phase 4–6 by ~30h, **Phase 7 started
no later than hour 30**. Backup/restore is what is graded; it must not be the
thing that runs out of time. If you are behind at hour 30, cut Phase 6 charts
and Phase 5 duplicate linking before you cut anything in Phase 7.

### 48 hours cuts SCOPE, never QUALITY

The tags above decide **what gets built**. They never decide **how well**. A
feature is either done properly or not started — a half-built feature is worse
than a missing one, because it fails live in front of judges instead of simply
being absent from the demo.

These are non-negotiable on every line of code that ships, at every hour on the
clock:

| Never cut | Why |
|---|---|
| **Input validation at every route** | An unvalidated body is a 500 during the demo, or a corrupted restore |
| **Permission check in the service layer** | Not the UI. Hiding a button is not authorization |
| **Transactions where two writes must both land** | Status + history; the whole restore. Half-written state is unrecoverable mid-hackathon |
| **Tests on the graded path** | Phase 7's round-trip and rollback tests ARE the WEB-C16 claim |
| **No PII in public payloads or logs** | Explicit rule on the brief's checklist |
| **No secrets in the backup file** | OAuth tokens are live credentials |
| **Reviewed, committed migrations** | A schema you cannot reproduce is a demo you cannot restore into |

Speed comes from **building fewer things**, not from building things worse.
When time is short the correct move is to drop a 🟡 row from this plan, not to
skip the validation on a 🔴 one.

### Phase 0 — Close the auth loop 🔴 — ✅ DONE except 0.1/0.3 (needs Google credentials)

| # | Task | Files | Done when |
|---|---|---|---|
| 0.1 | Create Google OAuth client, put real credentials in `.env.local` | `.env.local` | values are not `placeholder` |
| 0.2 | Build `/sign-in` page using the existing button | `src/app/sign-in/page.tsx` | page renders, no 404 from middleware |
| 0.3 | Sign in with a real Google account end to end | — | a row exists in `user`, `account`, and `profiles` |
| 0.4 | Add a `/api/me` route returning the session | `src/app/api/me/route.ts` | returns 401 anonymous, user JSON signed in |

**0.3 is the real milestone.** It is the first proof the `databaseHooks`
profile creation actually fires.

### Phase 1 — Roles and authorization 🔴 — ✅ DONE

| # | Task | Files | Done when |
|---|---|---|---|
| 1.1 | `role` enum (`CITIZEN`/`OFFICER`/`ADMIN`) + column on `profiles`, default `CITIZEN` | `src/modules/auth/schema/profiles.ts` | migration generated and applied |
| 1.2 | `getCurrentUser()` returning session + profile + role in one cached call | `src/modules/auth/session.ts` | one DB round-trip per request |
| 1.3 | `requireRole(...roles)` helper that throws a typed `ForbiddenError` | `src/modules/auth/permissions.ts` | citizen hitting an admin action gets 403 |
| 1.4 | Script to promote a user to ADMIN by email | `src/modules/auth/seed-admin.ts` | your own account is ADMIN |
| 1.5 | Tests: each role against one allowed and one forbidden action | `src/modules/auth/permissions.test.ts` | `bun test` green |

**Why role lives on `profiles`, not `user`:** the auth library owns and migrates
`user`. Product columns there get overwritten on the next CLI regeneration.

### Phase 2 — Departments and issues 🔴 — ✅ DONE

| # | Task | Files | Done when |
|---|---|---|---|
| 2.1 | `departments` table | `src/modules/departments/schema/departments.ts` | migration applied |
| 2.2 | Seed 5 departments (Roads, Water, Electricity, Sanitation, Public Safety) | `src/db/seed.ts` | `select` returns 5 rows |
| 2.3 | `department_id` on `profiles` (nullable — citizens have none) | `src/modules/auth/schema/profiles.ts` | FK enforced |
| 2.4 | `status` + `priority` enums | `src/db/schema/enums.ts` (shared) | types inferred in TS |
| 2.5 | `issues` table + `number bigserial` + FKs | `src/modules/issues/schema/issues.ts` | migration applied |
| 2.6 | Indexes: `status`, `department_id`, `reported_by`, `created_at` | same | present in the SQL |
| 2.7 | Register relations for the new tables | `src/db/relations.ts` | `db.query.issues` with `with:` compiles |

Index choice is not decoration: every list screen filters by status or
department, and the dashboard groups by them.

### Phase 3 — Issue lifecycle tables 🔴 — ✅ DONE

| # | Task | Files | Done when |
|---|---|---|---|
| 3.1 | `issue_history` (issue, actor, old→new status, note, timestamp) | `src/modules/issues/schema/issue-history.ts` | migration applied |
| 3.2 | `comments` | `src/modules/issues/schema/comments.ts` | migration applied |
| 3.3 | `attachments` (URL/key + type — **never** file bytes) | `src/modules/issues/schema/attachments.ts` | migration applied |
| 3.4 | `issue_duplicates` (primary ↔ duplicate) | `src/modules/issues/schema/issue-duplicates.ts` | migration applied |
| 3.5 | Relations for all four | `src/db/relations.ts` | one query returns an issue with its full timeline |

`issue_history` is append-only. Nothing updates or deletes a history row — that
is what makes the timeline trustworthy, and it is what the backup restores to
prove relationships survived.

### Phase 4 — Issue APIs 🔴 — ✅ DONE

| # | Task | Route | Who |
|---|---|---|---|
| 4.1 | Zod-free input validation helpers (or add a schema lib — decide once) | — | — |
| 4.2 | `createIssue` service + route | `POST /api/issues` | CITIZEN+ |
| 4.3 | `listIssues` with filters (status, category, department, priority) + pagination | `GET /api/issues` | public |
| 4.4 | `getIssue` incl. history, comments, attachments | `GET /api/issues/:id` | public |
| 4.5 | `updateIssue` (title/description, own issue only) | `PATCH /api/issues/:id` | owner or ADMIN |
| 4.6 | Comments create/list | `POST|GET /api/issues/:id/comments` | CITIZEN+ |
| 4.7 | **Pre-submit duplicate search** — category + location radius + text match | `POST /api/issues/check-duplicates` | CITIZEN+ |
| 4.8 | `createIssue` accepts an optional `possibleDuplicateOf` from 4.7 | — | CITIZEN+ |
| 4.9 | Tests for each route's permission matrix | `src/modules/issues/*.test.ts` | green |

**4.7 is a brief requirement, not a nicety:** *"The system should show possible
existing reports before creating a duplicate."* It runs on the create path,
before the row exists, using only what the form has — category, location, and
the title/description text. Rule-based is fine: same category AND within ~500m
AND trigram/ILIKE title overlap. No AI needed to satisfy the brief.

Pagination from the start. A backup demo with 1500 issues will hang an
unpaginated list endpoint in front of the judges.

### Phase 5 — Workflow 🔴 — ✅ DONE

| # | Task | Route | Who |
|---|---|---|---|
| 5.1 | `transitionStatus()` service enforcing the legal state machine | — | OFFICER+ |
| 5.2 | Every transition writes an `issue_history` row **in the same transaction** (`dbPool`) | — | — |
| 5.3 | Assign issue to officer/department | `PATCH /api/issues/:id/assign` | OFFICER+ |
| 5.4 | Change priority | `PATCH /api/issues/:id/priority` | OFFICER+ |
| 5.5 | **RESOLVED requires a resolution note or evidence** — rejected at the service layer if empty | — | OFFICER+ |
| 5.6 | Link/unlink duplicate to a master issue (**link only, never delete**) | `POST /api/issues/:id/duplicates` | OFFICER+ |
| 5.7 | Tests: illegal transitions rejected (e.g. RESOLVED → SUBMITTED) | — | green |
| 5.8 | Test: resolving with an empty note is rejected | — | green |

5.5 and 5.6 are the brief's IMPORTANT RULES in code form: *"Resolution should
include a note or evidence"* and *"Duplicate reports should be grouped or
linked, not silently deleted."* Both are enforced in the service layer, because
UI-only enforcement is not enforcement.

5.2 is the reason `dbPool` exists. A status change without its history row is
corrupt data, and the HTTP client cannot guarantee both land.

Duplicate detection stays rule-based. AI is a Phase 8 stretch, never a
dependency.

### Phase 6 — Dashboard 🔴 (charts 🟡) — ✅ DONE

| # | Task | Route |
|---|---|---|
| 6.1 | Counts by status, plus total and high-priority | `GET /api/dashboard` |
| 6.2 | Group by category / department | same |
| 6.3 | Issues over time (daily buckets) | same |
| 6.4 | Average resolution time (from `issue_history`) | same |
| 6.5 | **Public tracking view** — issue status + timeline with **no personal information** | `GET /api/public/issues/:id` |
| 6.6 | Test: the public payload contains no email, no reporter name, no exact address | — |

6.5/6.6 cover two MVP checklist items ("Public tracking") and the *"Personal
information must remain private"* rule at once. The test is the proof.

One endpoint, one round-trip. Several `count(*)` queries in a single SQL
statement beat six sequential HTTP calls to Neon.

### Phase 7 — ⭐ Backup & Restore (the graded phase) — ✅ DONE

Split small, because this is what gets marked.

| # | Task | Files | Done when |
|---|---|---|---|
| 7.1 | Write the format spec (§6 below) into `src/modules/backup/format.ts` as types + `FORMAT_VERSION` | `src/modules/backup/format.ts` | types compile |
| 7.2 | `exportBackup()` — read every table in FK order, redact secrets | `src/modules/backup/export.ts` | returns a typed object |
| 7.3 | `GET /api/admin/backup/export` — ADMIN only, `Content-Disposition` download | route | non-admin gets 403 |
| 7.4 | **Redaction test: the export contains no token, secret, or session** | `src/modules/backup/export.test.ts` | asserts on the serialized JSON |
| 7.5 | `validateBackup()` — format, version, required tables, field types | `src/modules/backup/validate.ts` | rejects a truncated file with a useful message |
| 7.6 | Referential validation — every FK in the payload resolves inside the payload | same | rejects an issue pointing at a missing department |
| 7.7 | `POST /api/admin/backup/preview` — counts per table, no writes | route | returns counts for a valid file |
| 7.8 | `restoreBackup()` — one `dbPool.transaction`, insert in FK order | `src/modules/backup/restore.ts` | partial failure leaves the DB untouched |
| 7.9 | `POST /api/admin/backup/restore` — ADMIN only, multipart upload | route | 403 for non-admin |
| 7.10 | Round-trip test: export → wipe → restore → deep-equal | `src/modules/backup/roundtrip.test.ts` | green |
| 7.11 | Rollback test: corrupt row mid-file → zero rows written | same | green |

**7.11 is the single most valuable test in the repo.** It is the literal claim
you will make to the judges, and the only proof is a test that fails when it
stops being true.

### Phase 8 — Hardening and demo 🟡 — ✅ 8.1/8.4 DONE, 8.2 needs the Neon console, 8.3 needs credentials

| # | Task |
|---|---|
| 8.1 | Seed script producing realistic demo data (~50 issues across departments/statuses) |
| 8.2 | Neon branch as the "fresh empty copy" for the restore demo |
| 8.3 | Rehearse the demo script (§7) end to end, timed |
| 8.4 | README: setup, env vars, migration, first admin |
| 8.5 | Stretch only if everything above is green: attachments upload, map view, AI duplicate detection |


### Phase 9 — 🤖 AI Civic Triage (standout feature) 🟢→🟡 — ✅ DONE (needs GEMINI_API_KEY to run)

Added after the backend was complete, from a second ChatGPT planning round
(share link, 12:37 PM message "How can I add ai in project or standout
feature"). Rationale kept here so the reasoning is not lost.

**Why it earns its place, in one line:** our pg_trgm duplicate search compares
CHARACTER trigrams, so it matches "Big pothole near the university entrance" to
"Huge pothole near university gate" (0.47 measured) but MISSES "Big crater on
road outside university gate" — no shared trigrams. Embeddings catch that.
"Possible duplicate grouping" is an MVP chip and appears three times in the
brief, so closing that gap is worth more than any other AI feature.

**Provider:** Google Gemini — chosen for its free tier, which matters for a
hackathon where the demo may be run many times. Called over plain REST
(`generativelanguage.googleapis.com`) rather than an SDK: one less dependency,
one less version to guess at, and the request shape is stable.

Model ids come from env so a newer model is a config change, not a code change:
`GEMINI_MODEL` (triage) and `GEMINI_EMBEDDING_MODEL` (embeddings). The vector
column is fixed at **768 dimensions** at migration time — that is
`text-embedding-004`'s native size, and newer Gemini embedding models can be
truncated to 768 via `outputDimensionality`, so the column does not need to
change if the model does.

**Two rules that are not negotiable:**

1. **AI never blocks a submission.** Triage runs AFTER the issue row is
   committed. A citizen reporting a hazard cannot wait on an LLM, and must not
   fail because a provider is down or rate-limited. On any error the issue keeps
   the citizen's own category and a null ai_* set.
2. **AI recommends, an officer decides.** Every ai_* field is a SUGGESTION
   stored alongside — never a substitute for — the real `category`, `priority`
   and `departmentId`. An officer accepts or modifies. This is also the better
   hackathon story: "AI assists authorities rather than replacing them."

| # | Task | Files | Done when |
|---|---|---|---|
| 9.1 | `ai_*` columns + `pgvector` extension + `embedding vector(768)` + index | `src/modules/issues/schema/issues.ts` | migration applied |
| 9.2 | Gemini REST wrapper, model ids from env, hard timeout | `src/modules/ai/client.ts` | typed, times out cleanly |
| 9.3 | `triageIssue()` — category, priority score, department, summary, confidence | `src/modules/ai/triage.ts` | returns null on any failure, never throws |
| 9.4 | Called after `createIssue` commits; failure leaves the issue intact | `src/modules/issues/service.ts` | issue still created when the key is invalid |
| 9.5 | Embedding written on create; semantic duplicate search merged with trigram | `src/modules/issues/duplicates.ts` | "crater" matches "pothole" |
| 9.6 | Officer accept/modify endpoint for AI suggestions | `api/issues/[id]/triage/` | writes real fields + a history entry |
| 9.7 | **Backup format v2** — carries ai_* fields; v1→v2 migration fills them null | `src/modules/backup/format.ts`, `validate.ts` | a v1 file still imports |
| 9.8 | Tests: triage parsing, fallback on provider error, v1 backup import | `src/modules/ai/*.test.ts` | green without an API key |

**The v2 bump is a gift, not a cost.** "Our backup format is versioned so old
backups still import" stops being a claim: export a v1 backup, add AI, import it
on the new schema, watch the migration fill the new fields. The seam already
exists in `validate.ts` and was built empty for exactly this.

**Embeddings and the backup:** the vector column is NOT exported. It is derived
data, it would multiply the file size by an order of magnitude, and it can be
recomputed. Restored issues get embeddings lazily or via a backfill script.

---

## 5a. How we come first

Most teams will finish the eight MVP chips. The chips are the entry fee, not the
win. WEB-C16 is where the ranking is decided, because it is the only item the
brief says will be **actively tested by the evaluator**. Everything below is
achievable inside 48 hours and is what separates a working submission from the
top of the table.

### The four differentiators

**1. The failed restore.** Every team will demo a successful import. Almost
nobody will demo a *failed* one. Upload a deliberately corrupted backup, show
the error naming the exact offending row, then show the database completely
unchanged. That single 20-second moment proves transactional integrity, which
is the hardest part of the challenge and the part nobody can fake. (Phase 7.11.)

**2. A backup that carries zero credentials and still restores a working app.**
Users export with their original ids so all foreign keys resolve; OAuth tokens
and sessions are never in the file; users re-link automatically on their next
Google sign-in via `trustedProviders`. Most teams will either dump the whole
database (leaking tokens — a rule violation) or skip users entirely (breaking
every relationship). We do neither. (§6.)

**3. A versioned format with a migration path.** `version: 1` in the header, a
migration function per version step, and a file from an older schema that still
imports. Demonstrating this answers "what happens when your schema changes?"
before a judge asks it.

**4. Proof instead of claims.** Run `bun test` on stage. The round-trip test,
the rollback test, and the "no PII in public payload" test each assert a
sentence from the brief. Judges hear claims all day; they rarely see a passing
test that encodes the requirement.

### Where teams lose that we won't

| Failure | Our defence |
|---|---|
| Empty-looking app during the demo | Phase 8.1 seeds ~50 realistic issues across departments and statuses |
| List endpoint hangs on the backup dataset | Pagination from Phase 4.3, not retrofitted |
| Demo dies because they wiped their only database | Neon branch as the fresh copy — the working database is never touched |
| Duplicate detection was skipped or is post-hoc | Phase 4.7 runs it pre-submit, exactly as the brief words it |
| PII leaks in the public view | Phase 6.6 tests for it |
| Restore half-succeeds and corrupts state live | `dbPool` transaction, Phase 7.8 |
| No story for the last question | Every rule on the brief maps to a task in this file |

### Rehearse the demo three times

Not once. Judges score what they see in a few minutes; a fumbled export button
costs more than a missing chart. Time it, cut anything that doesn't land, and
know exactly which terminal window has the tests already run.

---

## 6. Backup format v2 (spec — as built)

```jsonc
{
  "format": "public-issue-tracker",
  "version": 2,
  "createdAt": "2026-09-05T10:30:00.000Z",
  "applicationVersion": "1.0.0",
  "data": {
    "departments":     [ /* id, name, description */ ],
    "users":           [ /* id, name, email, image, role, departmentId */ ],
    "issues":          [ /* ... + ai_* suggestion fields (v2), NO embedding */ ],
    "issueHistory":    [ /* ... */ ],
    "comments":        [ /* ... */ ],
    "attachments":     [ /* url/key only, no bytes */ ],
    "issueDuplicates": [ /* ... */ ]
  }
}
```

### Never exported

| Table | Why |
|---|---|
| `account` | holds Google `access_token` / `refresh_token` — **live credentials to real Google accounts**. Leaking these is far worse than leaking password hashes. |
| `session` | active login tokens |
| `verification` | short-lived challenge values |
| `rate_limit` | operational counters, meaningless after restore |

### Why restoring users still works

Users are exported with their **original ids**, so every foreign key in the
restored issues resolves. Their `account` row is *not* restored — so on the
fresh copy they sign in with Google again, and because `auth/index.ts` sets
`trustedProviders: ["google"]` with `allowDifferentEmails: false`, Better Auth
links them back to their restored account by verified email automatically.

**The backup carries zero credentials and the restored app is still fully
functional.** Say this out loud during judging.

### PII decision (brief rule: "Personal information must remain private")

The export contains user names and emails, so the file itself is personal data.
Decide once, and be able to say it out loud:

- Export is **ADMIN-only** and served with `Content-Disposition: attachment`;
  it is never a public URL and never logged.
- Emails are kept in the file, because dropping them breaks the automatic
  re-link on next Google sign-in described above. The file is treated as a
  privileged artifact, exactly like a database dump.
- If the judges prefer redaction, `exportBackup({ redactEmails: true })` writes
  a hashed placeholder instead — one flag, decided at export time. Build the
  flag; it costs ten minutes and answers the question on the spot.

### Restore order (FK dependency order)

```
departments → users → issues → issueHistory → comments → attachments → issueDuplicates
```

### Restore algorithm

```
parse JSON
  ↓ fail → 400, nothing written
validate format + version
  ↓ fail → 400, nothing written
validate every FK resolves inside the payload
  ↓ fail → 400, naming the offending row
BEGIN (dbPool.transaction)
  insert in FK order
  ↓ any error → ROLLBACK → 500, "no changes were made"
COMMIT
```

Version handling: a file with `version > FORMAT_VERSION` is rejected outright.
Older versions get a migration function per step.

**This is live, not theoretical.** v1 → v2 (the AI fields) is implemented in
`validate.ts` and `migration.test.ts` proves a v1 document — exported before AI
existed — still imports on the v2 schema with the new fields filled null.

**`embedding` is not in the format.** It is derived data, it would multiply the
file size by an order of magnitude, and `bun run ai:backfill` recomputes it
after a restore.

---

## 7. Demo script (rehearse this)

1. Sign in as ADMIN
2. Dashboard — counts, charts
3. Open an issue, show its timeline (submitted → acknowledged → assigned → resolved)
4. Admin → Backup & Restore → **EXPORT** → JSON downloads
5. Open the JSON: point out the version header, and that **no tokens are in it**
6. Switch to the empty Neon branch — genuinely empty, show the zero counts
7. Upload the JSON → **preview** shows counts → **RESTORE**
8. Dashboard on the fresh copy now matches step 2
9. Open the same issue — history, comments and relationships all intact
10. Optional and strongest: upload a deliberately corrupted backup, show the
    error naming the bad row, and show the database unchanged

Step 10 is the difference between "we wrote an import button" and "we built a
restore system".

### Two additions since the AI layer landed

- **Show the duplicate check before submitting.** Type a reworded complaint
  ("big crater outside the university gate") and show it matching an existing
  pothole report tagged **matched by meaning** — trigram alone cannot do that.
- **Import a v1 backup.** Restore a file exported before the AI fields existed
  and show it importing cleanly on the v2 schema. That answers "what happens
  when your schema changes?" with a demonstration instead of an assurance.

---

## 8. Open questions

1. ~~Official WEB03/WEB-C16 wording~~ — **resolved**, transcribed verbatim in §1
   from the team-allocation page and the WEB03 card.
2. **Exact submission deadline** — the 48h budget in §5 needs a real start time
   to become a schedule.
3. **Team split** — phases are ordered for one person. With more, Phase 4/5
   (issues) and Phase 7 (backup) can run in parallel once Phase 3 lands. Phase 7
   should be owned by whoever is strongest, not whoever is free.
4. **Attachments storage** — object storage bucket, or is a URL field enough for
   the demo? The brief says evidence is *optional*, so a URL field satisfies it.
   The `attachments` table exists and is exported/restored; nothing uploads to it
   yet.
5. **Does the evaluator restore into a fresh database or a fresh deployment?**
   Changes whether users must be restorable at all. Ask at the venue if possible;
   our design handles both.

---

## 9. Learnings and gotchas (verified in-session)

Everything here cost real debugging time. Read before touching the area.

### Drizzle v1 (`1.0.0-rc.4`)

- **`relations()` no longer exists.** v1 replaced it with `defineRelations(schema, r => ...)`
  in `src/db/relations.ts`. Verified: `typeof relations === "undefined"`.
  Table files contain columns only.
- **`drizzle(url, { schema })` does not type-check for Postgres.** The option is
  `{ relations }`. Old tutorials will send you the wrong way.
- **`pgTable`'s third argument is an ARRAY**, not an object. The object form is
  deprecated in the installed typings.
- **No top-level `casing` option in drizzle-kit v1.** Column names are written
  explicitly in snake_case.
- **`drizzle-kit generate` asks for hints** when it cannot tell a rename from a
  create. Answer with e.g.
  `bun run db:generate --hints '[{"type":"create","kind":"table","entity":["public","issues"]}]'`.
- **Migration folder layout is `<out>/<timestamp>_<name>/{migration.sql,snapshot.json}`** —
  not the old `0001_x.sql` + `meta/_journal.json`.
- **drizzle-kit never emits `CREATE EXTENSION`.** `pg_trgm` was added by hand at
  the top of the `issues` migration. Any future extension needs the same, or it
  works locally and fails on a fresh restore.
- **drizzle-kit ships its own skill docs** in `node_modules/drizzle-kit/skills/`.
  They are authoritative for the installed version — read them before guessing.

### Environment loading

- **`drizzle-kit`'s bin has a `#!/usr/bin/env node` shebang**, so Bun's automatic
  `.env` loading never applies. Scripts use
  `node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs <verb>`.
- **`bun test` sets `NODE_ENV=test`, and Bun deliberately skips `.env.local` in
  test mode.** The `test` script passes `--env-file=.env.local` explicitly.
- **`.gitignore`'s `.env*` also swallowed `.env.example`.** Fixed with a
  `!.env.example` negation placed AFTER the pattern — last match wins.

### Better Auth (`1.7.2`)

- **The CLI generates drizzle v0 code.** After every
  `bunx @better-auth/cli generate --config src/modules/auth/index.ts --output src/modules/auth/schema/auth.ts`:
  1. delete the trailing `relations()` blocks (they live in `src/db/relations.ts`)
  2. delete the now-unused `relations` import
  The file header repeats these steps.
- **Sessions are database-backed, not JWT.** Defaults: 7-day expiry, refreshed
  once per day of use, cookie cache OFF.
- **`transaction: true` requires the WebSocket pool.** The adapter defaults to
  `false` because most Neon setups use HTTP; we pass the pool and `true` so
  sign-up cannot half-write a user.
- **`rateLimit.storage` defaults to `"memory"`, which is a no-op on serverless.**
  Set to `"database"`, which needs the generated `rate_limit` table.
- **Its timestamps are `timestamp` (no timezone)** while ours are `timestamptz`.
  Safe (it always writes UTC), but never compare the two in raw SQL without a cast.

### Neon drivers

- **`db` (neon-http) cannot do transactions.** `db.transaction()` throws; use
  `db.batch([...])` or `dbPool`.
- **`dbPool` (neon-serverless) works in Node 22+ without the `ws` package** —
  `neonConfig.webSocketConstructor ??= globalThis.WebSocket`. Verified with a
  real BEGIN/COMMIT.
- **Postgres sequences are not transactional.** A rolled-back insert still
  advances `issues.number`, so demo issue numbers may skip. Harmless.

### Next.js 16

- **Typed routes:** a new page fails to type-check until `bun run build` (or
  `next dev`) regenerates the route registry. `PageProps<"/sign-in">` does not
  exist before the first build.
- **`?redirectTo` must be validated to start with `/`** before being used as a
  callback, or a crafted link can bounce a signed-in user to another origin.

### Domain rules now encoded in code

- **State machine** (`workflow.ts`): SUBMITTED → ACKNOWLEDGED → IN_PROGRESS →
  RESOLVED, with REJECTED reachable from any open state. RESOLVED and REJECTED
  are TERMINAL — a recurring problem is a new report, which keeps resolution
  times honest and preserves the original timeline.
- **Closing requires a note** (`requiresNote`), enforced in the pure module and
  again in the service.
- **Officer scope:** officers act only on issues in their own department; an
  untriaged issue (no department yet) is open to any officer so nothing is
  stranded. Admins act anywhere.
- **Duplicate links are recorded on BOTH timelines** and never delete an issue.

### Demo data (Phase 8)

`bun run db:seed:demo` produces a believable backlog, deterministically (fixed
PRNG seed, so a rehearsed demo matches the live one) and idempotently (every row
it owns is prefixed `seed_` and removed before re-seeding).

Current shape: 50 issues — 9 SUBMITTED, 8 ACKNOWLEDGED, 12 IN_PROGRESS,
18 RESOLVED, 3 REJECTED; 13 open high/critical; average resolution 58.3h;
spread across 23 distinct days and all 5 departments; 5 duplicate links.

### ⏭ NEXT SESSION — Neon demo branch (task 8.2, still open)

The Neon project is named **"tu hackathon"** and lives under the
**yashsharmaofficially@gmail.com** account. The Neon MCP in the last session was
authenticated to a DIFFERENT account and could not see it:

- `DATABASE_URL` is on `c-4.ap-southeast-1`
- the only reachable org (`org-muddy-cake-76894892`, "Yash") holds just
  `signoz-auth` (`c-5.us-east-2`) and `Yash` (`c-2.ap-southeast-1`)
- searches for "tu" and "hackathon" in that org returned nothing
- the token is org-scoped: `list_projects` without `org_id` is rejected, so
  personal-account projects are invisible to it too

**To finish 8.2, either:**

1. Reconnect the Neon MCP as `yashsharmaofficially@gmail.com` (`/mcp` → Neon →
   authenticate), then create the branch and pull its connection string, or
2. Neon Console → **tu hackathon** → Branches → New branch from `main`, named
   `demo-restore`; copy the pooled connection string; run
   `DATABASE_URL=<branch-url> bun run db:migrate` (schema only, no rows).

Then dry-run the restore into that branch BEFORE judging, so the demo path is
proven rather than attempted live.

### AI layer (Phase 9)

- **`GEMINI_API_KEY` is optional.** With no key: `aiEnabled` is false, every AI
  path returns null, and the app behaves exactly as it did in Phase 8. Tests
  assert this.
- **Enrichment runs AFTER the create transaction commits, unawaited.** A model
  outage or timeout can never delay or fail a citizen's report.
- **ai_\* columns are suggestions.** Only `POST /api/issues/:id/triage` turns
  them into real fields, and it stamps `aiReviewedAt` plus a history entry.
- **Duplicate search now merges trigram + embeddings.** Candidates carry
  `matchedBy: "text" | "meaning" | "both"`; agreement sorts first. With no key
  it silently falls back to trigram alone.
- **`embedding` is never exported.** Derived, huge, recomputable — `ai:backfill`
  regenerates it after a restore.
- **Backup format is now v2**, and `migration.test.ts` proves a v1 file still
  imports with the AI fields filled null.

### Backup and restore (Phase 7)

- **`bun run test:backup` WIPES every product table** in whatever `DATABASE_URL`
  points at. Guarded behind `ALLOW_DESTRUCTIVE_TESTS=1` so a plain `bun test`
  can never do it. Point it at a Neon branch.
- **Validation runs entirely before the transaction opens.** A bad file costs
  zero database work, and the error names the offending row and field.
- **Two failure modes are tested separately:** one caught by referential
  validation (issue → missing department) and one that only fails mid-INSERT
  (duplicate primary key). The second is the one the transaction exists for.
- **`issues.number` is a bigserial: restoring explicit numbers does NOT advance
  its sequence.** Without `setval` after the restore, the next new issue collides
  with a restored one. Covered by a test.
- **Restore defaults to `empty-only`** and refuses a non-empty database;
  `?mode=replace` wipes and restores inside the same transaction, so a failed
  replace does not leave an empty database.

### Dashboard and public tracking

- **One query, not six.** Postgres `count(*) FILTER (WHERE ...)` collapses every
  status count into a single scan; six sequential counts would be six HTTPS
  round-trips to Neon.
- **`byDepartment` LEFT JOINs from `departments`** so a department with zero
  issues still appears. A missing row reads as a bug; "Sanitation: 0" is
  information.
- **Average resolution time is null, never 0, when nothing is resolved.**
  Verified: a 36h-old resolved issue reports `36.0`.
- **Public tracking is by issue NUMBER**, because that is what the citizen was
  given. It always returns the public shape, even to an officer — an endpoint
  whose payload changes by role is one refactor away from leaking.

### Drizzle v1 relational queries

- **`db.query.*.findMany({ where })` takes an OBJECT filter, not raw SQL.**
  `where: { status: "OPEN" }`, with `OR` / `AND` / `NOT` / `RAW` keys for the
  rest. Passing `and(eq(...))` fails to type-check.
- **`orderBy` is an object too:** `orderBy: { createdAt: "desc" }`.
- **Use `db.$count(table, filter)`** for counts; it takes SQL conditions, so a
  filtered list + total needs the filter in both forms (see `listIssues`).

### Bun

- **Bun resolves `node_modules` from the SCRIPT's location, not the cwd.** A
  scratch script outside the project cannot import `drizzle-orm`; keep temporary
  checks inside the repo and delete them after.
