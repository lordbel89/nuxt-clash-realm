CREATE TABLE "history_entries" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "history_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"tournament_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"reason" text,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "history_entries_tournament_id_idx" ON "history_entries" ("tournament_id","id");--> statement-breakpoint
CREATE INDEX "history_entries_entity_idx" ON "history_entries" ("tournament_id","entity","entity_id","id");--> statement-breakpoint
ALTER TABLE "history_entries" ADD CONSTRAINT "history_entries_tournament_id_tournaments_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id");--> statement-breakpoint
ALTER TABLE "history_entries" ADD CONSTRAINT "history_entries_actor_id_users_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id");