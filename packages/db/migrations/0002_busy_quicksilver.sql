CREATE TYPE "public"."customer_approval_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "approval_status" "customer_approval_status" DEFAULT 'APPROVED' NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "submitted_by" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "submitted_by_name" text;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;