CREATE TABLE "presider_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_id" uuid,
	"file_name" text NOT NULL,
	"payload" jsonb NOT NULL,
	"applied_at" timestamp with time zone,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "initials" text;--> statement-breakpoint
ALTER TABLE "presider_imports" ADD CONSTRAINT "presider_imports_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_initials_idx" ON "users" USING btree ("initials");