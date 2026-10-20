import type { TournamentId, UserId } from '#shared/types/ids';
import { bigint, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tournaments } from './tournaments.ts';
import { users } from './users.ts';

/** Cosa riguarda una voce di storico. Si allarga con le entità che hanno un comando (match, round…). */
export type HistoryEntity = 'tournament';

/**
 * Lo storico del torneo: una tabella sola, solo aggiunta. La scrive l'helper dei comandi
 * (`runTournamentCommand`) nella stessa transazione della modifica, mai un trigger: il trigger non
 * vede l'utente applicativo né la motivazione. Registra anche le intenzioni che non cambiano lo
 * stato (un risultato respinto, una conferma).
 *
 * In produzione il ruolo Postgres dell'app ha solo `INSERT` e `SELECT` qui (F0.11).
 *
 * `id` è l'ordine: i comandi di un torneo sono serializzati dal blocco della sua riga, quindi
 * dentro un torneo cresce nell'ordine in cui le cose sono successe. `at` è l'istante della
 * transazione e le voci di uno stesso comando lo condividono.
 */
export const historyEntries = pgTable('history_entries', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  tournamentId: uuid('tournament_id').$type<TournamentId>().notNull().references(() => tournaments.id),
  entity: text('entity').$type<HistoryEntity>().notNull(),
  // L'entità è polimorfa (torneo, match, partecipante…): nessuna chiave esterna
  entityId: uuid('entity_id').notNull(),
  action: text('action').notNull(),
  actorId: uuid('actor_id').$type<UserId>().notNull().references(() => users.id),
  reason: text('reason'),
  before: jsonb('before'),
  after: jsonb('after'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  // «Cos'è successo in questo torneo» e «cos'è successo a questo match»
  index('history_entries_tournament_id_idx').on(table.tournamentId, table.id),
  index('history_entries_entity_idx').on(table.tournamentId, table.entity, table.entityId, table.id),
]);

export type HistoryEntryRow = typeof historyEntries.$inferSelect;
export type NewHistoryEntryRow = typeof historyEntries.$inferInsert;
