import { TournamentIdParams } from '#shared/schemas/tournament';
import { pipeTournamentEvents } from '../../../realtime/stream.ts';
import { findVisibleTournament } from '../../../services/tournaments.ts';

/**
 * GET /api/tournaments/:id/stream — flusso SSE degli eventi del torneo. Stessa visibilità di
 * `GET /api/tournaments/:id`: pubblico da `published` in poi, una bozza solo per l'organizzazione.
 * Il permesso si controlla alla connessione, non a ogni evento: i messaggi portano solo identificativi.
 */
export default defineEventHandler(async (event): Promise<void> => {
  const { id } = readParams(event, TournamentIdParams);
  const db = await useDatabase();

  if (!await findVisibleTournament(db, id, await findUserId(event))) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Torneo non trovato' });
  }

  const notifier = await useNotifier();
  // h3 manda `X-Accel-Buffering: no`: dietro nginx (CapRover) il buffering fermerebbe gli eventi
  const stream = createEventStream(event);

  const close = pipeTournamentEvents(notifier, id, message => stream.push(message));
  stream.onClosed(close);

  return stream.send();
});
