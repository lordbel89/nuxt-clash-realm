/**
 * Avvia pg-boss all'accensione, se i job sono abilitati (`NUXT_JOBS_ENABLED=true`). In v1 nessuna
 * funzione ne ha bisogno, quindi è spento: avviarlo crea lo schema `pgboss` nel database e fa partire
 * i suoi cicli di manutenzione. Lo spegnimento è in `database.ts`, che ferma pg-boss prima di chiudere
 * il database.
 */
export default defineNitroPlugin(async () => {
  if (!useRuntimeConfig().jobs.enabled) return;

  // Un avvio fallito non deve impedire al server di partire: i tornei si giocano anche senza job
  await useBoss().catch(error => console.error('[pg-boss] avvio fallito:', error));
});
