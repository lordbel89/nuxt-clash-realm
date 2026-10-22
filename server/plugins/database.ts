import { closeDatabase } from '../database/client.ts';
import { stopBoss } from '../jobs/boss.ts';

/** Ferma ascolto e job, poi chiude la connessione allo spegnimento del server. */
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('close', async () => {
    // Ascolto e job stanno sul client del database: vanno fermati prima di chiuderlo
    await getNotifierInstance()?.then(notifier => notifier.stop()).catch(() => {});
    await getBossInstance()?.then(stopBoss).catch(() => {});

    const pending = getDatabaseInstance();

    if (!pending) return;

    // Se la connessione non è mai riuscita ad aprirsi non c'è nulla da chiudere
    await pending.then(closeDatabase).catch(() => {});
  });
});
