import type { TournamentId } from '#shared/types/ids';

/**
 * Il canale Postgres su cui l'helper dei comandi annuncia che un torneo è cambiato. Il notifier
 * (F0.9) vi ascolta e smista ai client SSE; qui c'è solo ciò che i due lati condividono.
 */
export const TOURNAMENT_CHANNEL = 'tournament_events';

/**
 * Gli eventi che un comando può emettere. Portano solo identificativi: il client rilegge lo stato.
 * Si allarga con gli atti (F4.1 li porta in `shared/types/live.ts` e ne fa il catalogo).
 */
export type TournamentEvent = { type: 'tournament.updated'; };

/** Ciò che viaggia in `pg_notify`: Postgres lo limita a 8000 byte, quindi niente stato. */
export interface TournamentNotification {
  tournamentId: TournamentId;
  event: TournamentEvent;
}
