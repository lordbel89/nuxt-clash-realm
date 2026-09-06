import type { User } from '#shared/types/user';
import type { UserRow } from '../database/schema/users.ts';

/**
 * Unico punto in cui la riga del database diventa contratto dell'API.
 * La firma è il controllo di coerenza: se aggiungi un campo a `User` questo
 * mapper non compila finché non lo mappi, e se togli una colonna da `users`
 * non compila comunque. `passwordHash` non passa di qui.
 */
export function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}
