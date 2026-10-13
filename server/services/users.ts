import type { Database } from '../database/client.ts';
import type { UserId } from '#shared/types/ids';
import type { UserListQuery } from '#shared/schemas/user';
import type { Paginated } from '#shared/types/api';
import type { User, UserSummary } from '#shared/types/user';
import { eq, ilike, or } from 'drizzle-orm';
import { users } from '../database/schema/users.ts';
import { toUser, toUserSummary } from '../mappers/user.ts';

/** `%`, `_` e `\` sono speciali in ILIKE: chi cerca «100%» cerca il carattere, non un jolly. */
export function escapeLike(text: string) {
  return text.replace(/[\\%_]/g, '\\$&');
}

/**
 * Letture senza dipendenze HTTP; la sessione è verificata dagli handler.
 *
 * `search` trova il nome per sottostringa e l'email solo per intero (le email sono salvate in
 * minuscolo): chi conosce l'indirizzo trova la persona, ma gli indirizzi non si sondano a pezzi.
 */
export async function listUsers(db: Database, { limit, offset, search }: UserListQuery): Promise<Paginated<UserSummary>> {
  const pattern = search && `%${escapeLike(search)}%`;
  const email = search?.toLowerCase();

  // Lo stesso filtro in due forme: la query relazionale dà un alias alla tabella, quindi non
  // accetta l'SQL scritto sulle colonne, e il conteggio non accetta il filtro a oggetto
  const [rows, total] = await Promise.all([
    db.query.users.findMany({
      columns: { id: true, name: true },
      ...(search && { where: { OR: [{ name: { ilike: pattern } }, { email: { eq: email } }] } }),
      orderBy: { createdAt: 'asc', id: 'asc' },
      limit,
      offset,
    }),
    db.$count(users, search ? or(ilike(users.name, pattern!), eq(users.email, email!)) : undefined),
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
