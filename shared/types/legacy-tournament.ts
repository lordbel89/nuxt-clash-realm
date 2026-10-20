/**
 * Tipi provvisori del frontend, nati prima del backend e serviti solo dal mock dei tornei.
 * Rinominati `Legacy*` quando `shared/types/tournament.ts` è diventato il contratto vero (F0.7):
 * le pagine li importano con un alias finché Marco non le porta sui tipi nuovi. Poi questo file
 * si cancella.
 */

export type LegacyTournamentStatus = 'draft' | 'ready' | 'running' | 'paused' | 'finished';
export type LegacyMatchStatus = 'pending' | 'running' | 'finished';

export interface LegacyParticipant {
  id: string;
  name: string;
  seed?: number;
  avatar?: string;
}

export interface LegacyMatch {
  id: string;
  round: number;
  table?: string;
  status: LegacyMatchStatus;
  home?: LegacyParticipant;
  away?: LegacyParticipant;
  homeScore?: number;
  awayScore?: number;
  /** ISO date, usato dal timer del round */
  endsAt?: string;
}

export interface LegacyRound {
  number: number;
  label?: string;
  durationMinutes?: number;
  matches: LegacyMatch[];
}

export interface LegacyTournament {
  // Data fields
  id: string;

  // Config fields
  name: string;
  game: string;
  isTeam: boolean;
  maxParticipants?: number;
  startDate?: Date;
  description?: string;
  location?: {
    name?: string;
    position?: string; // TODO: capire qual'è il dato utile per il widget di maps
  };
  leagueId?: string;

  // Running fields
  status: LegacyTournamentStatus;
  participants: LegacyParticipant[];
  rounds: LegacyRound[];
  currentRound: number;
}

export interface LegacyStanding {
  participant: LegacyParticipant;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
}

/** Payload di creazione/configurazione torneo */
export type LegacyTournamentConfig = Omit<LegacyTournament, 'id' | 'status' | 'participants' | 'rounds' | 'currentRound'> & {
  roundDurationMinutes: number;
  maxParticipants: number;
  location: {
    name?: string;
    position?: string;
  };
};
