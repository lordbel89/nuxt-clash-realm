import type { User } from '#shared/types/user';
import type { UserRow } from '../database/schema/users.ts';

/**
 * Unico punto in cui la riga del database e il contratto dell'API si
 * incontrano. Gli handler non toccano mai una `Row` direttamente.
 *
 * C'è una direzione sola perché una sola ne serve: l'utente non nasce più da
 * un body nostro, lo crea Better Auth. Quando un'entità avrà un form suo
 * (i tornei), il file tornerà ad avere anche il verso opposto —
 * `toNewTournamentRow(input, organizerId): Input → NewRow`, dove finiscono la
 * traduzione dei campi e ciò che il client non manda. Valibot valida, non
 * traduce.
 */

/**
 * Riga → contratto d'uscita.
 * La firma è il controllo di coerenza: se aggiungi un campo a `User` questo
 * mapper non compila finché non lo mappi, e se togli una colonna da `users`
 * non compila comunque. È anche l'allowlist che tiene fuori dalla risposta le
 * colonne amministrative: `bannedAt`, `banReason`, `bannedUntil`.
 */
export function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}
