import type { UserId } from '#shared/types/ids';

/**
 * Contratto dell'API per l'utente: è questo che il frontend consuma, non la
 * riga del database. I campi sono elencati uno a uno (allowlist): una colonna
 * nuova in `users` non finisce qui da sola.
 */
export interface User {
  id: UserId;
  name: string;
  email: string;
  /** Verificata via email: resta false finché non ci sarà un mailer */
  emailVerified: boolean;
  isActive: boolean;
  /** ISO 8601: le date non sopravvivono a JSON, la conversione a Date spetta al frontend */
  createdAt: string;
}
