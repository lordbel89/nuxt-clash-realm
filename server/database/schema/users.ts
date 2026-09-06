import type { UserId } from '#shared/types/ids';
import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  // `$type` porta il marchio già nella riga: i mapper non devono castare
  id: uuid('id').$type<UserId>().primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  // Nullable: lascia spazio a un login esterno (OAuth) senza password locale
  passwordHash: text('password_hash'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

/** Riga così com'è nel database: non deve uscire da server/ */
export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
