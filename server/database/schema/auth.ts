import type { UserId } from '#shared/types/ids';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.ts';

/**
 * Tabelle di Better Auth. Le scriviamo a mano invece di incollare l'output di
 * `npx auth generate` per due motivi: restano nello stile del resto dello
 * schema (plurale, uuid, timestamptz) e le migrazioni continuano a nascere da
 * `npm run db:generate`, senza un secondo sistema di migrazione in parallelo.
 *
 * Vincolo da rispettare quando si tocca questo file: **i nomi delle proprietà
 * TypeScript sono il contratto con Better Auth** (`userId`, `expiresAt`,
 * `accountId`…), non i nomi delle colonne — quelli restano snake_case e la
 * libreria non li vede mai. Rinominare una proprietà rompe l'adapter in
 * silenzio; rinominare una colonna no.
 *
 * Nessuna di queste righe esce da server/: non hanno DTO né mapper.
 */

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').$type<UserId>().notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [index('sessions_user_id_idx').on(table.userId)]);

/**
 * Un metodo di autenticazione collegato a un utente. La password vive qui, in
 * chiaro mai: hash scrypt scritto da Better Auth, `providerId = 'credential'`.
 * Le colonne dei token servono ai provider OAuth, che oggi non usiamo.
 */
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').$type<UserId>().notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [index('accounts_user_id_idx').on(table.userId)]);

/** Token a scadenza: verifica email, reset password, cambio indirizzo. */
export const verifications = pgTable('verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, table => [index('verifications_identifier_idx').on(table.identifier)]);

export type SessionRow = typeof sessions.$inferSelect;
export type AccountRow = typeof accounts.$inferSelect;
export type VerificationRow = typeof verifications.$inferSelect;
