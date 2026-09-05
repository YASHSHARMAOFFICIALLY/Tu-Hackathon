-- pgvector, required by the embedding column and its HNSW index.
-- drizzle-kit does not emit extension statements; added by hand and must
-- survive any regeneration of this file.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "ai_category" "issue_category";--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "ai_priority" "issue_priority";--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "ai_priority_score" integer;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "ai_department_id" uuid;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "ai_summary" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "ai_reasoning" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "ai_confidence" integer;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "ai_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "embedding" vector(768);--> statement-breakpoint
CREATE INDEX "issues_embedding_idx" ON "issues" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_ai_department_id_departments_id_fkey" FOREIGN KEY ("ai_department_id") REFERENCES "departments"("id") ON DELETE SET NULL;