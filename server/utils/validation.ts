import type { ApiErrorData } from '#shared/types/api';
import type { H3Event } from 'h3';
import * as v from 'valibot';
import { createError, getQuery, getRouterParams, readBody } from 'h3';

/**
 * Validazione dell'input agli estremi degli handler.
 *
 * h3 offre già `readValidatedBody` e compagni, ma incapsulano l'errore lanciato
 * dal validatore dentro un proprio 400 ("Validation Error", payload annidato in
 * `data.data`): la forma della risposta non sarebbe più quella di `ApiErrorData`.
 * Leggiamo quindi da soli e validiamo, così l'errore che lanciamo è quello che
 * arriva al client.
 *
 * Sui due campi di testo di `createError`, qui e in ogni handler:
 * `statusMessage` è la reason phrase HTTP e h3 la ripulisce dei caratteri fuori
 * ASCII (`H3Error.toJSON`), quindi "già" ci arriverebbe come "gi". Resta in
 * inglese, breve e standard; il testo italiano per l'utente viaggia in
 * `message`, che Nitro inoltra intatto per tutti i 4xx.
 */

/** Trasforma gli issue di Valibot nell'unico 400 di validazione dell'API. */
export function validate<TSchema extends v.GenericSchema>(schema: TSchema, input: unknown): v.InferOutput<TSchema> {
  const result = v.safeParse(schema, input);

  if (!result.success) {
    const flat = v.flatten(result.issues);

    // `nested` raccoglie solo gli issue che hanno un percorso. Quando il body
    // non è nemmeno un oggetto (vuoto, null, un array) l'issue finisce in
    // `root`/`other`: senza questi il 400 uscirebbe senza un solo messaggio.
    const messages = [...flat.root ?? [], ...flat.other ?? []];

    const data: ApiErrorData = {
      fields: flat.nested,
      ...(messages.length > 0 && { messages }),
    };

    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Dati non validi',
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
