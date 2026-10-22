import type { TournamentId } from '#shared/types/ids';
import type { Notifier } from './notifier.ts';

/** Un messaggio SSE: `event:` e `data:`. */
export interface StreamMessage {
  event: string;
  data: string;
}

export interface TournamentStreamOptions {
  /** L'ora del server: la riceve il client in `hello`, per allineare il proprio cronometro. */
  now?: () => Date;
  /** Ogni quanto mandare un `ping` se non succede niente. Tiene aperta la connessione dietro i proxy. */
  keepAliveMs?: number;
}

export const KEEP_ALIVE_MS = 30_000;

/**
 * Collega i messaggi di un torneo a un flusso SSE.
 *
 * - `hello` `{ now }` alla connessione, e di nuovo dopo un `resync`: vuol dire «rileggi lo stato».
 *   L'iscrizione avviene prima del `hello`, così un evento che arriva subito dopo non va perso: il
 *   client lo riceve e rilegge.
 * - Ogni evento del torneo arriva col suo nome (`tournament.updated`) e i soli identificativi in
 *   `data`: lo stato si rilegge con una `GET`.
 * - `ping` a vuoto ogni `keepAliveMs`. h3 non scrive i commenti SSE: un evento che il client non
 *   ascolta serve allo stesso scopo.
 *
 * Ritorna la funzione che chiude il collegamento (iscrizione e timer).
 */
export function pipeTournamentEvents(
  notifier: Notifier,
  tournamentId: TournamentId,
  send: (message: StreamMessage) => void | Promise<void>,
  { now = () => new Date(), keepAliveMs = KEEP_ALIVE_MS }: TournamentStreamOptions = {},
): () => void {
  let closed = false;

  const push = (message: StreamMessage) => {
    if (closed) return;
    // Un flusso che non scrive più (anche subito, in modo sincrono) non deve far cadere il processo
    try {
      Promise.resolve(send(message)).catch(() => {});
    }
    catch {
      // La connessione è già chiusa: se ne occupa `onClosed`
    }
  };
  const hello = () => push({ event: 'hello', data: JSON.stringify({ now: now().toISOString() }) });

  const unsubscribe = notifier.subscribe(tournamentId, (message) => {
    if (message.type === 'resync') return hello();

    const { type, ...ids } = message;
    push({ event: type, data: JSON.stringify({ tournamentId, ...ids }) });
  });
  hello();

  const timer = setInterval(() => push({ event: 'ping', data: '{}' }), keepAliveMs);
  // Il timer non deve tenere vivo il processo allo spegnimento
  timer.unref();

  return () => {
    closed = true;
    clearInterval(timer);
    unsubscribe();
  };
}
