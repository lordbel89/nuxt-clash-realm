import type { UserId } from '#shared/types/ids';
import type { H3Event } from 'h3';
import type { Auth } from '../auth/index.ts';
import { createAuth } from '../auth/index.ts';
import { DEV_SECRET } from '../auth/env.ts';

/**
 * Unico punto di contatto fra Better Auth e il resto del backend: gli handler
 * di dominio non importano mai `createAuth`, chiedono qui una sessione già
 * verificata e ricevono identificativi marchiati. È l'equivalente di
 * `readInput` per l'autenticazione.
 */

let instance: Promise<Auth> | undefined;

/** Segreto di sviluppo: in produzione la variabile è obbligatoria. */
function resolveSecret(secret: string) {
  if (secret) return secret;

  if (import.meta.dev) return DEV_SECRET;

  throw new Error('Segreto di autenticazione non configurato: valorizza NUXT_AUTH_SECRET');
}

/**
 * Istanza condivisa, creata alla prima richiesta: dipende dal database, che è
 * a sua volta asincrono. Stessa cautela di `useDatabase()` — una creazione
 * fallita non resta in cache, altrimenti il server non si riprenderebbe più.
 */
export function useAuth(): Promise<Auth> {
  if (!instance) {
    const { auth } = useRuntimeConfig();

    const pending: Promise<Auth> = useDatabase()
      .then(db => createAuth(db, { secret: resolveSecret(auth.secret), url: auth.url }))
      .catch((error) => {
        if (instance === pending) instance = undefined;

        throw error;
      });

    instance = pending;
  }

  return instance;
}

/**
 * Sessione corrente, o `null` se la richiesta non ne porta una valida.
 *
 * Non si chiama `getSession`: h3 ne esporta già una (le sue sessioni sigillate
 * nel cookie, un altro meccanismo) e Nitro auto-importa entrambe — la nostra
 * vincerebbe silenziosamente su quella di h3.
 */
export async function getAuthSession(event: H3Event) {
  const auth = await useAuth();

  return await auth.api.getSession({ headers: event.headers });
}

/**
 * Sessione obbligatoria: 401 se manca. Il testo italiano sta in `message`,
 * come per gli errori di validazione — `statusMessage` resta la reason phrase.
 */
export async function requireSession(event: H3Event) {
  const session = await getAuthSession(event);

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Autenticazione richiesta',
    });
  }

  return session;
}

/**
 * Id dell'utente autenticato, marchiato. Better Auth restituisce una stringa
 * nuda: questo è il confine in cui diventa un `UserId`, come `brandedUuid()`
 * lo è per i parametri di rotta.
 */
export async function requireUserId(event: H3Event): Promise<UserId> {
  const session = await requireSession(event);

  return session.user.id as UserId;
}
