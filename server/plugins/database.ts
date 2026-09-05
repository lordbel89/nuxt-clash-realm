import { closeDatabase } from '../database/client.ts'

/** Chiude la connessione allo spegnimento del server. */
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('close', async () => {
    const pending = getDatabaseInstance()

    if (!pending) return

    // Se la connessione non è mai riuscita ad aprirsi non c'è nulla da chiudere
    await pending.then(closeDatabase).catch(() => {})
  })
})
