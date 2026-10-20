/**
 * ponytail: bozze della UI per dati che il backend non serve ancora (partecipanti, match,
 * classifiche: F2, F3). Non sono contratto, nessuna rotta li restituisce. Quando il tipo vero
 * arriva in `shared/types/`, si cambia l'import e si cancella la voce da qui.
 */

export type MatchStatus = 'pending' | 'running' | 'finished';

export interface Participant {
  id: string;
  name: string;
  seed?: number;
  avatar?: string;
}

export interface Match {
  id: string;
  round: number;
  table?: string;
  status: MatchStatus;
  home?: Participant;
  away?: Participant;
  homeScore?: number;
  awayScore?: number;
  /** ISO date, usato dal timer del round */
  endsAt?: string;
}

export interface Standing {
  participant: Participant;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
}
