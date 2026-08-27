-- Drop duplicate (user_id, field_id) rows accumulated by re-running the seed script against a
-- table with no uniqueness constraint (its onConflictDoNothing() was a silent no-op) — keep one
-- arbitrary row per pair before the primary key below can be added.
DELETE FROM "user_fields" a USING "user_fields" b
  WHERE a.ctid < b.ctid AND a.user_id = b.user_id AND a.field_id = b.field_id;
--> statement-breakpoint
ALTER TABLE "user_fields" ADD CONSTRAINT "user_fields_user_id_field_id_pk" PRIMARY KEY("user_id","field_id");