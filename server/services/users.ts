import type { Database } from '../database/client.ts';
import type { UserId } from '#shared/types/ids';
import type { ListQuery } from '#shared/schemas/common';
import type { Paginated } from '#shared/types/api';
import type { User, UserSummary } from '#shared/types/user';
import { users } from '../database/schema/users.ts';
import { toUser, toUserSummary } from '../mappers/user.ts';

/** Letture senza dipendenze HTTP; la sessione è verificata dagli handler. */
export async function listUsers(db: Database, { limit, offset }: ListQuery): Promise<Paginated<UserSummary>> {
  const [rows, total] = await Promise.all([
    db.query.users.findMany({
      columns: { id: true, name: true },
      orderBy: { createdAt: 'asc', id: 'asc' },
      limit,
      offset,
    }),
    db.$count(users),
  ]);

  // Totale informativo: le due letture possono osservare scritture concorrenti.
  return { items: rows.map(toUserSummary), total, limit, offset };
}

export async function findUserSummary(db: Database, id: UserId): Promise<UserSummary | null> {
  const row = await db.query.users.findFirst({
    where: { id: { eq: id } },
    columns: { id: true, name: true },
  });
  return row ? toUserSummary(row) : null;
}

/** actorId deve provenire dalla sessione, mai da parametri o body. */
export async function getOwnAccount(db: Database, actorId: UserId): Promise<User | null> {
  const row = await db.query.users.findFirst({
    where: { id: { eq: actorId } },
    columns: { id: true, name: true, email: true, emailVerified: true, isActive: true, createdAt: true },
  });
  return row ? toUser(row) : null;
}
