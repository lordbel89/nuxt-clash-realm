export type TournamentFormat = 'single-elimination' | 'double-elimination' | 'round-robin' | 'swiss'
export type TournamentStatus = 'draft' | 'ready' | 'running' | 'paused' | 'finished'
export type MatchStatus = 'pending' | 'running' | 'finished'

export interface Participant {
  id: string
  name: string
  seed?: number
  avatar?: string
}

export interface Match {
  id: string
  round: number
  table?: string
  status: MatchStatus
  home?: Participant
  away?: Participant
  homeScore?: number
  awayScore?: number
  /** ISO date, usato dal timer del round */
  endsAt?: string
}

export interface Round {
  number: number
  label?: string
  durationMinutes?: number
  matches: Match[]
}

export interface Tournament {
  id: string
  name: string
  game: string
  format: TournamentFormat
  status: TournamentStatus
  currentRound: number
  participants: Participant[]
  rounds: Round[]
}

export interface Standing {
  participant: Participant
  played: number
  wins: number
  draws: number
  losses: number
  points: number
}

/** Payload di creazione/configurazione torneo */
export type TournamentConfig = Pick<Tournament, 'name' | 'game' | 'format'> & {
  roundDurationMinutes: number
  maxParticipants: number
}
