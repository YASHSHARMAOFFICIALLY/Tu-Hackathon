-- Required by the trigram index on issues.title, used by the pre-submit
-- duplicate search. drizzle-kit does not emit extension statements, so this
-- line is added by hand and must survive any regeneration of this file.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "issue_category" AS ENUM('ROADS', 'WATER_SUPPLY', 'ELECTRICITY', 'SANITATION', 'PUBLIC_SAFETY', 'OTHER');--> statement-breakpoint
CREATE TYPE "issue_priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "issue_status" AS ENUM('SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"number" bigserial UNIQUE,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" "issue_category" NOT NULL,
	"address" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"status" "issue_status" DEFAULT 'SUBMITTED'::"issue_status" NOT NULL,
	"priority" "issue_priority" DEFAULT 'MEDIUM'::"issue_priority" NOT NULL,
	"reported_by" text,
	"assigned_to" text,
	"department_id" uuid,
	"resolution_note" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "departments_name_idx" ON "departments" ("name");--> statement-breakpoint
CREATE INDEX "issues_status_idx" ON "issues" ("status");--> statement-breakpoint
CREATE INDEX "issues_department_idx" ON "issues" ("department_id");--> statement-breakpoint
CREATE INDEX "issues_reported_by_idx" ON "issues" ("reported_by");--> statement-breakpoint
CREATE INDEX "issues_assigned_to_idx" ON "issues" ("assigned_to");--> statement-breakpoint
CREATE INDEX "issues_created_at_idx" ON "issues" ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "issues_category_idx" ON "issues" ("category");--> statement-breakpoint
CREATE INDEX "issues_title_trgm_idx" ON "issues" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_reported_by_user_id_fkey" FOREIGN KEY ("reported_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_department_id_departments_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL;