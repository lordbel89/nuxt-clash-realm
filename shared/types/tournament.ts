import type { TournamentId } from '#shared/types/ids';
import type { OrganizationSummary } from '#shared/types/organization';

/**
 * Contratto del torneo (F0.7). I tipi provvisori che lo precedevano sono in
 * `legacy-tournament.ts`, finché le pagine non passano a questi.
 *
 * Partecipanti, round, match e classifiche arrivano con i loro step (F2, F3): qui c'è solo ciò
 * che il torneo è prima di partire.
 */

/** Il ciclo di vita del glossario. La pausa non è uno stato del torneo: è del cronometro del round. */
export type TournamentStatus
  = | 'draft'
    | 'published'
    | 'registration_open'
    | 'checkin_open'
    | 'running'
    | 'finished'
    | 'cancelled';

export interface TournamentLocation {
  name: string;
  /** Per la mappa; il formato non è ancora fissato */
  position: string | null;
}

/** Quanto basta per un elenco. */
export interface TournamentSummary {
  id: TournamentId;
  name: string;
  /** Testo libero: il catalogo dei giochi arriverà con i preset */
  game: string;
  status: TournamentStatus;
  organization: OrganizationSummary;
  /** Fuso IANA del torneo (`Europe/Rome`): date e orari si mostrano in questo fuso, non in quello del browser */
  timezone: string;
  /** ISO 8601 in UTC; null finché l'organizzatore non fissa la data */
  startsAt: string | null;
}

export interface Tournament extends TournamentSummary {
  /**
   * Lo stesso inizio come orario locale nel fuso del torneo, `2026-11-29T10:00`: è il valore da
   * rimettere nel form, nella stessa forma in cui lo si invia.
   */
  startsAtLocal: string | null;
  description: string | null;
  /** Posti disponibili; null = nessun limite */
  maxParticipants: number | null;
  location: TournamentLocation | null;
  /** ISO 8601 */
  createdAt: string;
}
