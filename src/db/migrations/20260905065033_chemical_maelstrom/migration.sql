CREATE TYPE "issue_event" AS ENUM('CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'PRIORITY_CHANGED', 'DEPARTMENT_CHANGED', 'DUPLICATE_LINKED', 'COMMENTED');--> statement-breakpoint
CREATE TABLE "issue_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"issue_id" uuid NOT NULL,
	"actor_id" text,
	"event" "issue_event" NOT NULL,
	"old_status" "issue_status",
	"new_status" "issue_status",
	"old_priority" "issue_priority",
	"new_priority" "issue_priority",
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"issue_id" uuid NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"issue_id" uuid NOT NULL,
	"uploaded_by" text,
	"url" text NOT NULL,
	"file_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_duplicates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"primary_issue_id" uuid NOT NULL,
	"duplicate_issue_id" uuid NOT NULL,
	"linked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_duplicates_not_self" CHECK ("primary_issue_id" <> "duplicate_issue_id")
);
--> statement-breakpoint
CREATE INDEX "issue_history_issue_idx" ON "issue_history" ("issue_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_issue_idx" ON "comments" ("issue_id","created_at");--> statement-breakpoint
CREATE INDEX "attachments_issue_idx" ON "attachments" ("issue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_duplicates_pair_idx" ON "issue_duplicates" ("primary_issue_id","duplicate_issue_id");--> statement-breakpoint
CREATE INDEX "issue_duplicates_primary_idx" ON "issue_duplicates" ("primary_issue_id");--> statement-breakpoint
ALTER TABLE "issue_history" ADD CONSTRAINT "issue_history_issue_id_issues_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "issue_history" ADD CONSTRAINT "issue_history_actor_id_user_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_issue_id_issues_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_user_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_issue_id_issues_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "issue_duplicates" ADD CONSTRAINT "issue_duplicates_primary_issue_id_issues_id_fkey" FOREIGN KEY ("primary_issue_id") REFERENCES "issues"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "issue_duplicates" ADD CONSTRAINT "issue_duplicates_duplicate_issue_id_issues_id_fkey" FOREIGN KEY ("duplicate_issue_id") REFERENCES "issues"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "issue_duplicates" ADD CONSTRAINT "issue_duplicates_linked_by_user_id_fkey" FOREIGN KEY ("linked_by") REFERENCES "user"("id") ON DELETE SET NULL;