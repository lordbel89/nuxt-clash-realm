export type TournamentStatus = 'draft' | 'ready' | 'running' | 'paused' | 'finished'
export type MatchStatus = 'pending' | 'running' | 'finished'

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
  // Config fields
  id: string;
  name: string;
  game: string;
  status: TournamentStatus;
  isTeam: boolean;
  startDate: Date;

  // Running fields
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
export type TournamentConfig = Pick<Tournament, 'name' | 'game' | 'isTeam'> & {
  roundDurationMinutes: number;
  maxParticipants: number;
}
