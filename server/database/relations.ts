import { defineRelations } from 'drizzle-orm';
import * as schema from './schema/index.ts';

/**
 * Relational Queries v2: le relazioni vivono qui, separate dallo schema.
 * Con una sola tabella non c'è ancora nulla da collegare, ma passare l'oggetto
 * a drizzle() è ciò che abilita `db.query.users`.
 * Quando arriveranno tornei/round/match: defineRelations(schema, (r) => ({ ... })).
 */
export const relations = defineRelations(schema);
