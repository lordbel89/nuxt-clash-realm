import type { Paginated } from '#shared/types/api';
import type { User } from '#shared/types/user';
import { ListQuery } from '#shared/schemas/common';
import { users } from '../database/schema/users.ts';
import { toUser } from '../mappers/user.ts';

/** GET /api/users — elenco paginato degli utenti */
export default defineEventHandler(async (event): Promise<Paginated<User>> => {
  const { limit, offset } = readQuery(event, ListQuery);

  const db = await useDatabase();

  const [rows, total] = await Promise.all([
    db.query.users.findMany({
      orderBy: { createdAt: 'asc' },
      limit,
      offset,
    }),
    db.$count(users),
  ]);

  return { items: rows.map(toUser), total, limit, offset };
});
