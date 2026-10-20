CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"game" text NOT NULL,
	"description" text,
	"timezone" text NOT NULL,
	"starts_at" timestamp with time zone,
	"status" text DEFAULT 'draft' NOT NULL,
	"max_participants" integer,
	"location_name" text,
	"location_position" text,
	"created_by" uuid NOT NULL,
	"seed" text NOT NULL,
	"ruleset" jsonb,
	"ruleset_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournaments_status_check" CHECK ("status" in ('draft', 'published', 'registration_open', 'checkin_open', 'running', 'finished', 'cancelled')),
	CONSTRAINT "tournaments_max_participants_check" CHECK ("max_participants" >= 2),
	CONSTRAINT "tournaments_location_check" CHECK ("location_position" is null or "location_name" is not null)
);
--> statement-breakpoint
CREATE INDEX "tournaments_organization_id_idx" ON "tournaments" ("organization_id");--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id");--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");