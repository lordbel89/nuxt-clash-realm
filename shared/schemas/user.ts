import type { UserId } from '#shared/types/ids';
import * as v from 'valibot';
import { brandedUuid, ListQuery } from './common.ts';

/**
 * Contratti d'ingresso dell'utente.
 *
 * Qui si valida la forma del contratto; permessi e stato spettano ai servizi. I messaggi
 * si scrivono per esteso: i default di Valibot sono in inglese e, viaggiando
 * in `ApiErrorData`, finirebbero sotto gli occhi dell'utente.
 *
 * Non c'è uno schema di registrazione: la creazione dell'utente appartiene a
 * Better Auth (`POST /api/auth/sign-up/email`), che valida per conto suo.
 */

/**
 * Parametri di rotta di `/api/users/:id`. Il marchio si applica qui, all'unico
 * confine in cui un id entra nel backend come stringa nuda: da questo punto in
 * poi è un `UserId` e il compilatore non lo confonde con altri identificativi.
 */
export const UserIdParams = v.object({
  id: brandedUuid<UserId>(),
}, 'Identificativo utente richiesto');

export type UserIdParams = v.InferOutput<typeof UserIdParams>;

/**
 * Elenco della rubrica, con la ricerca per trovare chi aggiungere a un'organizzazione o a uno
 * staff. `search` cerca nel nome per sottostringa, e nell'email solo per intero: chi conosce
 * l'indirizzo trova la persona, ma gli indirizzi non si scoprono per tentativi parziali.
 */
export const UserListQuery = v.object({
  ...ListQuery.entries,
  search: v.optional(v.pipe(
    v.string('Testo di ricerca non valido'),
    v.trim(),
    v.minLength(2, 'Scrivere almeno due caratteri'),
    v.maxLength(100, 'Testo di ricerca troppo lungo'),
  )),
}, 'Parametri di ricerca non validi');

export type UserListQuery = v.InferOutput<typeof UserListQuery>;
