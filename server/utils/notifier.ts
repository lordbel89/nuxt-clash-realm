import { listenSourceOf, type Notifier, startNotifier } from '../realtime/notifier.ts';

let instance: Promise<Notifier> | undefined;

/**
 * Il notifier del processo, creato alla prima richiesta: una sola connessione in ascolto per tutti i
 * client SSE. Auto-importato nel contesto Nitro: `const notifier = await useNotifier()`.
 */
export function useNotifier(): Promise<Notifier> {
  if (!instance) {
    // Stessa regola del database: un tentativo fallito non resta in cache
    const pending: Promise<Notifier> = useDatabase()
      .then(db => startNotifier(listenSourceOf(db)))
      .catch((error) => {
        if (instance === pending) instance = undefined;

        throw error;
      });

    instance = pending;
  }

  return instance;
}

/** Ritorna il notifier solo se già creato, senza aprire una connessione. */
export function getNotifierInstance() {
  return instance;
}
