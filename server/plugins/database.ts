import { closeDatabase } from '../database/client.ts';

/** Chiude l'ascolto e poi la connessione allo spegnimento del server. */
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('close', async () => {
    // L'ascolto sta sul client del database: va fermato prima di chiuderlo
    await getNotifierInstance()?.then(notifier => notifier.stop()).catch(() => {});

    const pending = getDatabaseInstance();

    if (!pending) return;

    // Se la connessione non è mai riuscita ad aprirsi non c'è nulla da chiudere
    await pending.then(closeDatabase).catch(() => {});
  });
});
