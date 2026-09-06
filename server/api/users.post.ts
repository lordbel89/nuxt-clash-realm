import type { User } from '#shared/types/user';
import { CreateUserInput } from '#shared/schemas/user';
import { users } from '../database/schema/users.ts';
import { toUser } from '../mappers/user.ts';

/** POST /api/users — crea un utente */
export default defineEventHandler(async (event): Promise<User> => {
  const input = await readInput(event, CreateUserInput);

  const db = await useDatabase();

  // Se il contratto d'ingresso non combacia con le colonne della tabella,
  // è questa insert a non compilare: nessun controllo aggiuntivo da mantenere
  const [row] = await db
    .insert(users)
    .values(input)
    .onConflictDoNothing({ target: users.email })
    .returning();

  if (!row) {
    throw createError({ statusCode: 409, statusMessage: 'Email già registrata' });
  }

  setResponseStatus(event, 201);

  return toUser(row);
});
