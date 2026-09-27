DROP INDEX "position_templates_unique";--> statement-breakpoint
ALTER TABLE "ministries" ADD COLUMN "roles" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "position_templates" ADD COLUMN "role" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "position_templates_unique" ON "position_templates" USING btree ("mass_time_id","ministry_id","role");