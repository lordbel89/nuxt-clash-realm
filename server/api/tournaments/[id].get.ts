import type { Tournament } from '#shared/types/tournament';
import { TournamentIdParams } from '#shared/schemas/tournament';
import { findVisibleTournament } from '../../services/tournaments.ts';

/** GET /api/tournaments/:id — pubblico da `published` in poi; una bozza solo per l'organizzazione. */
export default defineEventHandler(async (event): Promise<Tournament> => {
  const { id } = readParams(event, TournamentIdParams);
  const tournament = await findVisibleTournament(await useDatabase(), id, await findUserId(event));
  if (!tournament) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Torneo non trovato' });
  }
  return tournament;
});
