CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_role" text,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"status_code" integer NOT NULL,
	"request_body" text,
	"response_body" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_batches" ADD COLUMN "reopened_at" text;--> statement-breakpoint
ALTER TABLE "collection_batches" ADD COLUMN "reopened_by_name" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;