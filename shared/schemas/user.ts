import type { UserId } from '#shared/types/ids';
import * as v from 'valibot';
import { brandedUuid } from './common';

/**
 * Contratto d'ingresso per la creazione di un utente.
 * Vive in shared/ perché lo usano entrambi i lati: `UForm` per la validazione
 * del form e `server/api/users.post.ts` per quella del body. Una definizione
 * sola, quindi le due non possono divergere.
 *
 * Qui stanno le regole di business, non i vincoli del database: che `name` sia
 * `notNull` lo garantisce già la tabella, che sia lungo almeno due caratteri no.
 *
 * Anche i messaggi di tipo sono scritti per esteso: i default di Valibot sono
 * in inglese ("Invalid type: Expected Object…") e, viaggiando in
 * `ApiErrorData`, finirebbero sotto gli occhi dell'utente. Quello dell'oggetto
 * copre due posizioni — il body che non è un oggetto e la chiave mancante —
 * quindi è formulato per reggere in entrambe.
 */
export const CreateUserInput = v.object({
  name: v.pipe(
    v.string('Il nome deve essere un testo'),
    v.trim(),
    v.minLength(2, 'Il nome deve avere almeno 2 caratteri'),
    v.maxLength(80, 'Il nome non può superare gli 80 caratteri'),
  ),
  email: v.pipe(
    v.string('L\'email deve essere un testo'),
    v.trim(),
    v.toLowerCase(),
    v.email('Indirizzo email non valido'),
  ),
}, 'Dati mancanti o non validi');

/**
 * Il tipo derivato dallo schema: `typeof` porta la costante nello spazio dei
 * tipi, `InferOutput` ne estrae la forma. Così la definizione resta una sola.
 */
export type CreateUserInput = v.InferOutput<typeof CreateUserInput>;

/**
 * Parametri di rotta di `/api/users/:id`. Il marchio si applica qui, all'unico
 * confine in cui un id entra nel backend come stringa nuda: da questo punto in
 * poi è un `UserId` e il compilatore non lo confonde con altri identificativi.
 */
export const UserIdParams = v.object({
  id: brandedUuid<UserId>(),
});

export type UserIdParams = v.InferOutput<typeof UserIdParams>;
