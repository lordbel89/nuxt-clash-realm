import type { OrganizationId, UserId } from '#shared/types/ids';
import type { OrganizationRole } from '#shared/types/organization';
import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.ts';

/**
 * Organizzazioni e membri: tutto nostro. Better Auth gestisce solo account e login, quindi
 * queste righe le scrivono e le leggono soltanto i nostri servizi (server/services/organizations.ts).
 * Gli inviti via email, quando ci sarà un mailer, saranno una tabella nostra anche loro.
 */

export const organizations = pgTable('organizations', {
  id: uuid('id').$type<OrganizationId>().primaryKey().defaultRandom(),
  name: text('name').notNull(),
  // Identificativo leggibile negli URL, generato dal nome alla creazione e poi fisso
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const members = pgTable('members', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').$type<OrganizationId>().notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').$type<UserId>().notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Uno solo per membro, e solo questi due
  role: text('role').$type<OrganizationRole>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  unique('members_organization_user_unique').on(table.organizationId, table.userId),
  index('members_user_id_idx').on(table.userId),
  check('members_role_check', sql`${table.role} in ('owner', 'admin')`),
]);

export type OrganizationRow = typeof organizations.$inferSelect;
export type NewOrganizationRow = typeof organizations.$inferInsert;
export type MemberRow = typeof members.$inferSelect;
export type NewMemberRow = typeof members.$inferInsert;
