import type { UserSummary } from '#shared/types/user';
import { UserIdParams } from '#shared/schemas/user';
import { findUserSummary } from '../../services/users.ts';

/** GET /api/users/:id — non espone i dati privati, neppure per il proprio ID. */
export default defineEventHandler(async (event): Promise<UserSummary> => {
  await requireSession(event);
  const { id } = readParams(event, UserIdParams);
  const user = await findUserSummary(await useDatabase(), id);
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Utente non trovato' });
  }
  return user;
});
