import type { UserId } from '#shared/types/ids';
import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  // `$type` porta il marchio già nella riga: i mapper non devono castare
  id: uuid('id').$type<UserId>().primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  // Richiesto da Better Auth. Resta false finché non ci sarà un mailer che
  // possa spedire il link di verifica: `requireEmailVerification` è spento.
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  isActive: boolean('is_active').notNull().default(true),
  /**
   * Sospensione: colonne nostre, Better Auth non le conosce. Il divieto si
   * applica in `databaseHooks.session.create.before` (server/auth/index.ts),
   * unico punto attraversato da qualsiasi metodo di login.
   * `bannedUntil` null = sospensione a tempo indeterminato.
   */
  bannedAt: timestamp('banned_at', { withTimezone: true }),
  banReason: text('ban_reason'),
  bannedUntil: timestamp('banned_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

/** Riga così com'è nel database: non deve uscire da server/ */
export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
