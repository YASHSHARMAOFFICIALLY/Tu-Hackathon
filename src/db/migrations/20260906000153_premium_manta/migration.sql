-- Better Auth 1.7 made `account.issuer` required. Hand-edited from the
-- generated `ADD COLUMN ... NOT NULL`, which cannot run against a table that
-- already holds rows: the column arrives nullable, is backfilled from
-- `provider_id` (the same value for every provider this app uses), and only
-- then becomes NOT NULL.
ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint
UPDATE "account" SET "issuer" = "provider_id" WHERE "issuer" IS NULL;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_accountId_idx" ON "account" ("issuer","account_id");
