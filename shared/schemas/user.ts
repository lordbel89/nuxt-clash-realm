import type { UserId } from '#shared/types/ids';
import * as v from 'valibot';
import { brandedUuid } from './common';

/**
 * Contratti d'ingresso dell'utente.
 *
 * Qui stanno le regole di business, non i vincoli del database, e i messaggi
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
});

export type UserIdParams = v.InferOutput<typeof UserIdParams>;
