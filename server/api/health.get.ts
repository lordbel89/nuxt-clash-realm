import type { HealthStatus } from '#shared/types/health';
import { checkDatabase } from '../services/health.ts';

/**
 * GET /api/health — pubblico. 200 se il database risponde, altrimenti 503. Lo usa il controllo di
 * salute del container: CapRover non sposta il traffico su una versione che non lo supera.
 */
export default defineEventHandler(async (): Promise<HealthStatus> => {
  try {
    await checkDatabase(await useDatabase());
  }
  catch (error) {
    // Il 503 non dice il perché: senza questa riga, una password sbagliata non lascia traccia nei log
    console.error('[health] database non raggiungibile:', error);
    throw createError({ statusCode: 503, statusMessage: 'Service Unavailable', message: 'Database non raggiungibile' });
  }

  return { status: 'ok' };
});
