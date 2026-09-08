import type { User } from '#shared/types/user';
import { getOwnAccount } from '../../services/users.ts';

/** GET /api/users/me — l'identità arriva esclusivamente dalla sessione. */
export default defineEventHandler(async (event): Promise<User> => {
  const actorId = await requireUserId(event);
  const user = await getOwnAccount(await useDatabase(), actorId);
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Utente non trovato' });
  }
  return user;
});
