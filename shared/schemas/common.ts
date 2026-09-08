import * as v from 'valibot';

/**
 * Pezzi di contratto d'ingresso condivisi da più entità.
 * Le regole specifiche di un'entità stanno invece nel suo file.
 */

/**
 * UUID così come arriva dall'URL. Senza questo controllo un id malformato
 * raggiungerebbe Postgres come cast non valido: 500 al posto di un 400 sensato.
 */
export const Uuid = v.pipe(v.string('Identificativo richiesto'), v.uuid('Identificativo non valido'));

/**
 * UUID di rotta promosso a identificativo marchiato. Il cast vive solo qui:
 * ogni entità ne ha uno, e ripeterlo a mano sei volte è sei occasioni di
 * sbagliare marchio senza che il compilatore possa accorgersene.
 *
 *     export const UserIdParams = v.object({ id: brandedUuid<UserId>() })
 */
export function brandedUuid<TId extends string>() {
  return v.pipe(Uuid, v.transform(id => id as TId));
}

/** La query string arriva come stringa: si converte prima di validare il valore. */
function integerFromQuery(fallback: number, minimum: number, maximum: number) {
  return v.optional(
    v.pipe(
      v.pipe(v.string('Parametro numerico richiesto'), v.regex(/^\d+$/, 'Usare un intero non negativo in cifre decimali')),
      v.transform(Number),
      v.number('Valore non numerico'),
      v.integer('Valore non intero'),
      v.minValue(minimum, `Valore minimo ${minimum}`),
      v.maxValue(maximum, `Valore massimo ${maximum}`),
    ),
    String(fallback),
  );
}

/** Righe per pagina: tetto al lavoro che una singola richiesta può chiedere al database. */
export const MAX_LIMIT = 100;

/**
 * Tetto allo scorrimento. Postgres esegue un OFFSET scartando le righe una a
 * una, quindi il costo cresce con l'offset: consentirne uno arbitrario è una
 * query lenta a disposizione di chiunque. Oltre questa soglia la risposta è
 * un 400, e la strada giusta diventa la paginazione a cursore.
 */
export const MAX_OFFSET = 100_000;

/**
 * Paginazione di ogni elenco. I default valgono anche a query string vuota,
 * quindi `findMany` non resta mai senza tetto.
 */
export const ListQuery = v.object({
  limit: integerFromQuery(25, 1, MAX_LIMIT),
  offset: integerFromQuery(0, 0, MAX_OFFSET),
}, 'Parametri di ricerca non validi');

export type ListQuery = v.InferOutput<typeof ListQuery>;
