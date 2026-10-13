import { defineRelations } from 'drizzle-orm';
import * as schema from './schema/index.ts';

/**
 * Relational Queries v2: le relazioni vivono qui, separate dallo schema.
 * Passare l'oggetto a drizzle() è ciò che abilita `db.query.<tabella>`.
 */
export const relations = defineRelations(schema, r => ({
  users: {
    sessions: r.many.sessions(),
    accounts: r.many.accounts(),
    memberships: r.many.members(),
  },
  sessions: {
    user: r.one.users({
      from: r.sessions.userId,
      to: r.users.id,
      optional: false,
    }),
  },
  accounts: {
    user: r.one.users({
      from: r.accounts.userId,
      to: r.users.id,
      optional: false,
    }),
  },
  organizations: {
    members: r.many.members(),
  },
  members: {
    organization: r.one.organizations({
      from: r.members.organizationId,
      to: r.organizations.id,
      optional: false,
    }),
    user: r.one.users({
      from: r.members.userId,
      to: r.users.id,
      optional: false,
    }),
  },
}));
