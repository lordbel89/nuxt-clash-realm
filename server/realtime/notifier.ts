import type { TournamentId } from '#shared/types/ids';
import type { Database } from '../database/client.ts';
import { TOURNAMENT_CHANNEL, type TournamentEvent, type TournamentNotification } from './events.ts';

/**
 * Il notifier tiene una connessione dedicata in `LISTEN` per processo e smista in memoria ciò che
 * arriva ai client SSE iscritti a quel torneo. Le notifiche le fa `runTournamentCommand` con
 * `pg_notify`, nella stessa transazione della modifica: arrivano solo al commit.
 *
 * `LISTEN/NOTIFY` non conserva niente: se la connessione cade, gli eventi nel frattempo si perdono.
 * Alla riconnessione il notifier lo dice a tutti gli iscritti con `resync`, e il client rilegge lo
 * stato come alla prima connessione.
 */

/** Un evento di un torneo, oppure l'avviso che alcuni sono andati persi. */
export type NotifierMessage = TournamentEvent | { type: 'resync'; };

export type NotifierListener = (message: NotifierMessage) => void;

/**
 * Come si ascolta un canale: la differenza fra i due driver sta tutta qui. Ritorna la funzione che
 * smette di ascoltare. `onListen` scatta a ogni connessione, la prima compresa.
 */
export type ListenSource = (channel: string, onPayload: (payload: string) => void, onListen: () => void) => Promise<() => Promise<void>>;

export interface Notifier {
  /** Riceve gli eventi del torneo finché non si chiama la funzione che ritorna. */
  subscribe: (tournamentId: TournamentId, listener: NotifierListener) => () => void;
  /** Smette di ascoltare e lascia andare gli iscritti. */
  stop: () => Promise<void>;
}

/**
 * Il client sotto Drizzle: PGlite in sviluppo, postgres-js in produzione. Per capire quale sia basta
 * `options`, che ha solo postgres-js (anche `close` ce l'hanno entrambi).
 */
export function listenSourceOf(db: Database): ListenSource {
  const client = db.$client as unknown;

  if ('options' in (client as object)) {
    // postgres-js apre una connessione sua per l'ascolto e la riapre da solo se cade
    const sql = client as { listen: (channel: string, onNotify: (payload: string) => void, onListen: () => void) => Promise<{ unlisten: () => Promise<void>; }>; };
    return async (channel, onPayload, onListen) => (await sql.listen(channel, onPayload, onListen)).unlisten;
  }

  // PGlite è un solo processo, senza rete: non cade, quindi `onListen` scatta una volta
  const pglite = client as { listen: (channel: string, onNotify: (payload: string) => void) => Promise<() => Promise<void>>; };
  return async (channel, onPayload, onListen) => {
    const unlisten = await pglite.listen(channel, onPayload);
    onListen();
    return unlisten;
  };
}

/** Parte in ascolto subito: se non riesce, lancia e non lascia un notifier a metà. */
export async function startNotifier(listen: ListenSource): Promise<Notifier> {
  const subscribers = new Map<TournamentId, Set<NotifierListener>>();

  const deliver = (tournamentId: TournamentId, message: NotifierMessage) => {
    for (const listener of subscribers.get(tournamentId) ?? []) {
      // Un iscritto che lancia non deve togliere gli eventi agli altri
      try {
        listener(message);
      }
      catch {
        // Il suo errore è suo
      }
    }
  };

  let listening = false;
  const unlisten = await listen(
    TOURNAMENT_CHANNEL,
    (payload) => {
      const notification = parse(payload);
      if (notification) deliver(notification.tournamentId, notification.event);
    },
    () => {
      // La prima volta non si è perso niente; le successive sono riconnessioni
      if (listening) for (const tournamentId of subscribers.keys()) deliver(tournamentId, { type: 'resync' });
      listening = true;
    },
  );

  return {
    subscribe(tournamentId, listener) {
      const set = subscribers.get(tournamentId) ?? new Set();
      set.add(listener);
      subscribers.set(tournamentId, set);

      return () => {
        set.delete(listener);
        if (set.size === 0 && subscribers.get(tournamentId) === set) subscribers.delete(tournamentId);
      };
    },
    async stop() {
      subscribers.clear();
      await unlisten();
    },
  };
}

function parse(payload: string): TournamentNotification | null {
  try {
    const value = JSON.parse(payload) as Partial<TournamentNotification> | null;
    return value && typeof value.tournamentId === 'string' && typeof value.event?.type === 'string'
      ? value as TournamentNotification
      : null;
  }
  catch {
    // Un payload che non è nostro non ferma l'ascolto
    return null;
  }
}
