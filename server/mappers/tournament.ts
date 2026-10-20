import type { CreateTournamentInput, UpdateTournamentInput } from '#shared/schemas/tournament';
import type { UserId } from '#shared/types/ids';
import type { Tournament, TournamentLocation, TournamentSummary } from '#shared/types/tournament';
import type { NewTournamentRow, TournamentRow } from '../database/schema/tournaments.ts';
import { fromLocal, inTimeZone, toDate } from '../utils/time.ts';
import { type OrganizationSummarySource, toOrganizationSummary } from './organization.ts';

export type TournamentSummarySource = Pick<TournamentRow, 'id' | 'name' | 'game' | 'status' | 'timezone' | 'startsAt'>
  & { organization: OrganizationSummarySource; };

export type TournamentSource = TournamentSummarySource
  & Pick<TournamentRow, 'description' | 'maxParticipants' | 'locationName' | 'locationPosition' | 'createdAt'>;

/** Le colonne da chiedere al database per ciascuna vista: il servizio le passa a `columns`. */
export const TOURNAMENT_SUMMARY_COLUMNS = { id: true, name: true, game: true, status: true, timezone: true, startsAt: true } as const;
export const TOURNAMENT_COLUMNS = {
  ...TOURNAMENT_SUMMARY_COLUMNS,
  description: true,
  maxParticipants: true,
  locationName: true,
  locationPosition: true,
  createdAt: true,
} as const;

export function toTournamentSummary(row: TournamentSummarySource): TournamentSummary {
  return {
    id: row.id,
    name: row.name,
    game: row.game,
    status: row.status,
    organization: toOrganizationSummary(row.organization),
    timezone: row.timezone,
    startsAt: row.startsAt?.toISOString() ?? null,
  };
}

function toLocation(row: Pick<TournamentRow, 'locationName' | 'locationPosition'>): TournamentLocation | null {
  return row.locationName ? { name: row.locationName, position: row.locationPosition } : null;
}

/** Orario locale nel fuso del torneo, nella forma del form: `2026-11-29T10:00`. */
export function toLocalDateTime(instant: Date, timeZone: string) {
  return inTimeZone(instant, timeZone).toPlainDateTime().toString({ smallestUnit: 'minute' });
}

export function toTournament(row: TournamentSource): Tournament {
  return {
    ...toTournamentSummary(row),
    startsAtLocal: row.startsAt ? toLocalDateTime(row.startsAt, row.timezone) : null,
    description: row.description,
    maxParticipants: row.maxParticipants,
    location: toLocation(row),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * L'orario locale diventa un istante nel fuso del torneo (`compatible` nelle notti del cambio
 * d'ora); `location` si stende su due colonne. Stato iniziale, autore e seed non arrivano dal client.
 */
export function toNewTournamentRow(input: CreateTournamentInput, createdBy: UserId, seed: string): NewTournamentRow {
  return {
    organizationId: input.organizationId,
    name: input.name,
    game: input.game,
    description: input.description,
    timezone: input.timezone,
    startsAt: input.startsAt ? toDate(fromLocal(input.startsAt, input.timezone)) : null,
    status: 'draft',
    maxParticipants: input.maxParticipants,
    locationName: input.location?.name ?? null,
    locationPosition: input.location?.position ?? null,
    createdBy,
    seed,
  };
}

/**
 * I campi da scrivere per una modifica parziale: assente = invariato, `null` = svuotato.
 *
 * L'inizio si ricalcola anche quando cambia solo il fuso: l'organizzatore ha scelto «le 10», e le
 * 10 restano, nel fuso nuovo. È l'istante a spostarsi.
 */
export function toTournamentUpdate(input: UpdateTournamentInput, current: Pick<TournamentRow, 'timezone' | 'startsAt'>): Partial<NewTournamentRow> {
  const timezone = input.timezone ?? current.timezone;

  let startsAtLocal: string | null | undefined = input.startsAt;
  if (startsAtLocal === undefined && input.timezone !== undefined && current.startsAt) {
    startsAtLocal = toLocalDateTime(current.startsAt, current.timezone);
  }

  return {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.game !== undefined && { game: input.game }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.timezone !== undefined && { timezone }),
    ...(startsAtLocal !== undefined && { startsAt: startsAtLocal ? toDate(fromLocal(startsAtLocal, timezone)) : null }),
    ...(input.maxParticipants !== undefined && { maxParticipants: input.maxParticipants }),
    ...(input.location !== undefined && {
      locationName: input.location?.name ?? null,
      locationPosition: input.location?.position ?? null,
    }),
  };
}
