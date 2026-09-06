import type { ApiErrorData } from '#shared/types/api';
import type { H3Event } from 'h3';
import * as v from 'valibot';

/**
 * Validazione dell'input agli estremi degli handler.
 *
 * h3 offre già `readValidatedBody` e compagni, ma incapsulano l'errore lanciato
 * dal validatore dentro un proprio 400 ("Validation Error", payload annidato in
 * `data.data`): la forma della risposta non sarebbe più quella di `ApiErrorData`.
 * Leggiamo quindi da soli e validiamo, così l'errore che lanciamo è quello che
 * arriva al client.
 */

/** Trasforma gli issue di Valibot nell'unico 400 di validazione dell'API. */
export function validate<TSchema extends v.GenericSchema>(schema: TSchema, input: unknown): v.InferOutput<TSchema> {
  const result = v.safeParse(schema, input);

  if (!result.success) {
    const data: ApiErrorData = { fields: v.flatten(result.issues).nested };

    throw createError({
      statusCode: 400,
      statusMessage: 'Dati non validi',
      data,
    });
  }

  return result.output;
}

/** Corpo della richiesta validato: sostituisce `readBody` + `safeParse` in ogni handler. */
export async function readInput<TSchema extends v.GenericSchema>(event: H3Event, schema: TSchema) {
  return validate(schema, await readBody(event));
}

/** Parametri di rotta validati: è qui che un id passa da stringa nuda a identificativo marchiato. */
export function readParams<TSchema extends v.GenericSchema>(event: H3Event, schema: TSchema) {
  return validate(schema, getRouterParams(event));
}

/** Query string validata: paginazione, filtri, ordinamenti. */
export function readQuery<TSchema extends v.GenericSchema>(event: H3Event, schema: TSchema) {
  return validate(schema, getQuery(event));
}
