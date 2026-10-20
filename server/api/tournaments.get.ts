import type { Paginated } from '#shared/types/api';
import type { TournamentSummary } from '#shared/types/tournament';
import { TournamentListQuery } from '#shared/schemas/tournament';
import { listTournaments } from '../services/tournaments.ts';

/**
 * GET /api/tournaments — pubblico. Senza `organizationId` i tornei pubblicati di tutte le
 * organizzazioni; con `organizationId` quelli dell'organizzazione, bozze comprese per i membri.
 */
export default defineEventHandler(async (event): Promise<Paginated<TournamentSummary>> => {
  const query = readQuery(event, TournamentListQuery);
  return listTournaments(await useDatabase(), await findUserId(event), query);
});
