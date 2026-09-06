export type TournamentStatus = 'draft' | 'ready' | 'running' | 'paused' | 'finished';
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

export interface Round {
  number: number;
  label?: string;
  durationMinutes?: number;
  matches: Match[];
}

export interface Tournament {
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
  status: TournamentStatus;
  participants: Participant[];
  rounds: Round[];
  currentRound: number;
}

export interface Standing {
  participant: Participant;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
}

/** Payload di creazione/configurazione torneo */
export type TournamentConfig = Omit<Tournament, 'id' | 'status' | 'participants' | 'rounds' | 'currentRound'> & {
  roundDurationMinutes: number;
  maxParticipants: number;
};
