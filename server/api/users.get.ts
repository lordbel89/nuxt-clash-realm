import type { Paginated } from '#shared/types/api';
import type { User } from '#shared/types/user';
import { ListQuery } from '#shared/schemas/common';
import { users } from '../database/schema/users.ts';
import { toUser } from '../mappers/user.ts';

/** GET /api/users — elenco paginato degli utenti */
export default defineEventHandler(async (event): Promise<Paginated<User>> => {
  await requireSession(event);

  const { limit, offset } = readQuery(event, ListQuery);

  const db = await useDatabase();

  const [rows, total] = await Promise.all([
    db.query.users.findMany({
      // `createdAt` da solo non basta a ordinare: `defaultNow()` è il timestamp
      // della transazione, quindi righe inserite dallo stesso statement lo
      // condividono e l'ordine fra pagine non sarebbe deterministico (una riga
      // può ripetersi o sparire). `id` fa da spareggio.
      orderBy: { createdAt: 'asc', id: 'asc' },
      limit,
      offset,
    }),
    db.$count(users),
  ]);

  return { items: rows.map(toUser), total, limit, offset };
});
