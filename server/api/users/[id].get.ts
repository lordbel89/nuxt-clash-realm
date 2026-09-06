import type { User } from '#shared/types/user';
import { toUser } from '../../mappers/user.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/users/:id — singolo utente */
export default defineEventHandler(async (event): Promise<User> => {
  const id = getRouterParam(event, 'id');

  // Senza questo controllo un id malformato arriverebbe a Postgres come cast
  // non valido: errore 500 al posto di una risposta sensata
  if (!id || !UUID_PATTERN.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Identificativo utente non valido' });
  }

  const db = await useDatabase();

  const row = await db.query.users.findFirst({
    where: { id },
  });

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Utente non trovato' });
  }

  return toUser(row);
});
