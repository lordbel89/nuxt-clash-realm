import type { Tournament } from '#shared/types/tournament';
import { TournamentIdParams, UpdateTournamentInput } from '#shared/schemas/tournament';
import { findTournamentOrganization, updateTournament } from '../../services/tournaments.ts';

/** PATCH /api/tournaments/:id — owner e admin dell'organizzazione, finché il torneo non è chiuso. */
export default defineEventHandler(async (event): Promise<Tournament> => {
  const { id } = readParams(event, TournamentIdParams);
  const db = await useDatabase();

  const organizationId = await findTournamentOrganization(db, id);
  if (!organizationId) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Torneo non trovato' });
  }
  const { userId } = await requireOrganizationRole(event, organizationId, ANY_ORGANIZATION_ROLE);
  const input = await readInput(event, UpdateTournamentInput);

  const result = await updateTournament(db, id, userId, input);
  if (!result.ok && result.reason === 'not_found') {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Torneo non trovato' });
  }
  if (!result.ok) {
    throw createError({ statusCode: 409, statusMessage: 'Conflict', message: 'Un torneo concluso o annullato non si modifica più' });
  }
  return result.tournament;
});
