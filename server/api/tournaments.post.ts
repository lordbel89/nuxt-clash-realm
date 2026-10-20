import type { Tournament } from '#shared/types/tournament';
import { CreateTournamentInput } from '#shared/schemas/tournament';
import { createTournament } from '../services/tournaments.ts';

/** POST /api/tournaments — owner e admin creano un torneo della loro organizzazione, in bozza. */
export default defineEventHandler(async (event): Promise<Tournament> => {
  const input = await readInput(event, CreateTournamentInput);
  const { userId } = await requireOrganizationRole(event, input.organizationId, ANY_ORGANIZATION_ROLE);
  return createTournament(await useDatabase(), userId, input);
});
