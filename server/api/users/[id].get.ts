import type { User } from '#shared/types/user';
import { UserIdParams } from '#shared/schemas/user';
import { toUser } from '../../mappers/user.ts';

/** GET /api/users/:id — singolo utente */
export default defineEventHandler(async (event): Promise<User> => {
  await requireSession(event);

  const { id } = readParams(event, UserIdParams);

  const db = await useDatabase();

  // `{ eq: id }` e non `{ id }`: la forma abbreviata di Drizzle è disattivata
  // per le colonne di tipo oggetto, e un id marchiato conta come tale
  const row = await db.query.users.findFirst({
    where: { id: { eq: id } },
  });

  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Utente non trovato',
    });
  }

  return toUser(row);
});
