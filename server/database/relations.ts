import { defineRelations } from 'drizzle-orm';
import * as schema from './schema/index.ts';

/**
 * Relational Queries v2: le relazioni vivono qui, separate dallo schema.
 * Passare l'oggetto a drizzle() è ciò che abilita `db.query.<tabella>`.
 * Quando arriveranno tornei/round/match si aggiungono qui.
 */
export const relations = defineRelations(schema, r => ({
  users: {
    sessions: r.many.sessions(),
    accounts: r.many.accounts(),
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
}));
