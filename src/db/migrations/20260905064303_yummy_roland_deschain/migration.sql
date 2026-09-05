CREATE TYPE "user_role" AS ENUM('CITIZEN', 'OFFICER', 'ADMIN');--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "role" "user_role" DEFAULT 'CITIZEN'::"user_role" NOT NULL;