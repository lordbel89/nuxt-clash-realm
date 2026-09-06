import * as v from 'valibot';

/**
 * Pezzi di contratto d'ingresso condivisi da più entità.
 * Le regole specifiche di un'entità stanno invece nel suo file.
 */

/**
 * UUID così come arriva dall'URL. Senza questo controllo un id malformato
 * raggiungerebbe Postgres come cast non valido: 500 al posto di un 400 sensato.
 */
export const Uuid = v.pipe(v.string(), v.uuid('Identificativo non valido'));

/** La query string arriva come stringa: si converte prima di validare il valore. */
function integerFromQuery(fallback: number, minimum: number, maximum: number) {
  return v.optional(
    v.pipe(
      v.union([v.string(), v.number()]),
      v.transform(Number),
      v.number('Valore non numerico'),
      v.integer('Valore non intero'),
      v.minValue(minimum, `Valore minimo ${minimum}`),
      v.maxValue(maximum, `Valore massimo ${maximum}`),
    ),
    fallback,
  );
}

/**
 * Paginazione di ogni elenco. I default valgono anche a query string vuota,
 * quindi `findMany` non resta mai senza tetto.
 */
export const ListQuery = v.object({
  limit: integerFromQuery(25, 1, 100),
  offset: integerFromQuery(0, 0, Number.MAX_SAFE_INTEGER),
});

export type ListQuery = v.InferOutput<typeof ListQuery>;
