import * as v from 'valibot';

/**
 * Contratto d'ingresso per la creazione di un utente.
 * Vive in shared/ perché lo usano entrambi i lati: `UForm` per la validazione
 * del form e `server/api/users.post.ts` per quella del body. Una definizione
 * sola, quindi le due non possono divergere.
 *
 * Qui stanno le regole di business, non i vincoli del database: che `name` sia
 * `notNull` lo garantisce già la tabella, che sia lungo almeno due caratteri no.
 */
export const CreateUserInput = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(2, 'Il nome deve avere almeno 2 caratteri'),
    v.maxLength(80, 'Il nome non può superare gli 80 caratteri'),
  ),
  email: v.pipe(
    v.string(),
    v.trim(),
    v.toLowerCase(),
    v.email('Indirizzo email non valido'),
  ),
});

/**
 * Il tipo derivato dallo schema: `typeof` porta la costante nello spazio dei
 * tipi, `InferOutput` ne estrae la forma. Così la definizione resta una sola.
 */
export type CreateUserInput = v.InferOutput<typeof CreateUserInput>;
