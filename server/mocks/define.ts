import type { H3Event } from 'h3';

/**
 * Un mock è un JSON con i superpoteri di TypeScript: tipi del contratto,
 * faker, funzioni. Serve per lavorare su una pagina prima che l'endpoint
 * esista, o per riprodurre a comando uno stato che il database non ha.
 *
 * I file stanno in `server/mocks/*.mock.ts` e li serve
 * `server/middleware/mocks.ts`, solo in sviluppo.
 */

export interface MockContext {
  /** Parametri di rotta: i `:nome` dichiarati in `path` arrivano qui */
  params: Record<string, string>;
  /** Query string già parsata */
  query: Record<string, unknown>;
  /** Per i casi che `params` e `query` non coprono: body, header, cookie */
  event: H3Event;
}

export type MockMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface Mock<TData = unknown> {
  method: MockMethod;
  /** Percorso dell'endpoint, con `:nome` per i parametri: `'/api/tournaments/:id'` */
  path: string;
  /**
   * L'interruttore per singola chiamata. A `false` la richiesta prosegue
   * verso l'handler reale — se non c'è, torna il suo 404.
   * @default true
   */
  enabled?: boolean;
  /** Millisecondi di attesa prima di rispondere: è così che si vedono gli stati di caricamento. */
  delay?: number;
  /**
   * Il corpo della risposta. Un valore per dati fissi, una funzione per
   * generarli a ogni chiamata, leggere `params`/`query`, o simulare un
   * errore con `throw createError({ statusCode: 500 })`.
   */
  data: TData | ((context: MockContext) => TData | Promise<TData>);
}

/**
 * Identità: esiste solo per il tipo, cioè per avere il controllo del contratto
 * e l'autocompletamento dentro l'oggetto letterale.
 */
export function defineMock<TData>(mock: Mock<TData>): Mock<TData> {
  return mock;
}
