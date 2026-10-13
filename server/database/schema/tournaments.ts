import type { OrganizationId, TournamentId, UserId } from '#shared/types/ids';
import type { TournamentStatus } from '#shared/types/tournament';
import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.ts';
import { users } from './users.ts';

/**
 * Il torneo appartiene a un'organizzazione: non esistono tornei personali. Chi l'ha creato resta
 * solo come dato registrato (`createdBy`), senza un ruolo sul torneo.
 *
 * `startsAt` è un istante; il fuso con cui è stato scritto sta in `timezone`, perché `timestamptz`
 * non lo conserva. Le date locali si ricavano con `server/utils/time.ts`.
 */
export const tournaments = pgTable('tournaments', {
  id: uuid('id').$type<TournamentId>().primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').$type<OrganizationId>().notNull().references(() => organizations.id),
  name: text('name').notNull(),
  game: text('game').notNull(),
  description: text('description'),
  timezone: text('timezone').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  status: text('status').$type<TournamentStatus>().notNull().default('draft'),
  // null = nessun limite
  maxParticipants: integer('max_participants'),
  locationName: text('location_name'),
  locationPosition: text('location_position'),
  createdBy: uuid('created_by').$type<UserId>().notNull().references(() => users.id),
  /**
   * 256 bit in esadecimale, generati alla creazione con un generatore crittografico: il motore ne
   * deriva i sorteggi del torneo (`drawNumber`). Non esce mai sul filo: chi lo conosce prevede i
   * sorteggi.
   */
  seed: text('seed').notNull(),
  // La composizione risolta (F2.3): null finché l'organizzatore non la sceglie
  ruleset: jsonb('ruleset'),
  // 'free', 'preset:<gioco>@<versione>', 'custom' (F2.3, F15.3)
  rulesetOrigin: text('ruleset_origin'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [
  index('tournaments_organization_id_idx').on(table.organizationId),
  check('tournaments_status_check', sql`${table.status} in ('draft', 'published', 'registration_open', 'checkin_open', 'running', 'finished', 'cancelled')`),
  check('tournaments_max_participants_check', sql`${table.maxParticipants} >= 2`),
  // Una posizione senza nome di luogo non ha senso: il DTO espone `location` solo con il nome
  check('tournaments_location_check', sql`${table.locationPosition} is null or ${table.locationName} is not null`),
]);

export type TournamentRow = typeof tournaments.$inferSelect;
export type NewTournamentRow = typeof tournaments.$inferInsert;
