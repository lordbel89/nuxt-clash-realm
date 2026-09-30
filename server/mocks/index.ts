import type { H3Event } from 'h3';
import type { Mock, MockContext } from './define.ts';
import { addRoute, createRouter, findRoute } from 'rou3';
import tournaments from './tournaments.mock.ts';

/**
 * Registro dei mock: un file per entità, una riga qui. Niente scansione
 * automatica della cartella — l'elenco resta leggibile, e un mock che non è
 * in questa lista non può rispondere per sbaglio.
 *
 * Un file può esportare un mock solo o un array di mock (le rotte di una
 * stessa entità stanno bene insieme): `flat()` accetta entrambe le forme.
 */
const mocks: Mock[] = [
  tournaments,
].flat();

/**
 * `rou3` è il router di Nitro: riconosce `:id` e i metodi senza che dobbiamo
 * scrivere un matcher a mano.
 */
const router = createRouter<Mock>();

for (const mock of mocks) {
  addRoute(router, mock.method, mock.path, mock);
}

/** Header presente su ogni risposta che arriva da un mock e su nessun'altra. */
const MOCK_HEADER = 'MOCK_DATA';

/**
 * La risposta finta per questa richiesta, o `undefined` se nessun mock acceso
 * la copre — nel qual caso il middleware lascia proseguire la richiesta.
 */
export async function serveMock(event: H3Event) {
  // `event.path` include la query string, il router ragiona sul solo percorso
  const match = findRoute(router, event.method, event.path.split('?')[0]!);
  const mock = match?.data;

  if (!mock || mock.enabled === false) return;

  // Marchia la risposta: nel tab Network, e per chiunque la legga dopo, questi
  // dati non vengono dal database. Prima di `data`, così ce l'ha anche l'errore
  // che il mock dovesse lanciare.
  setResponseHeader(event, MOCK_HEADER, 'true');

  if (mock.delay) {
    await new Promise(resolve => setTimeout(resolve, mock.delay));
  }

  console.info(`[mock] ${event.method} ${event.path}`);

  if (typeof mock.data !== 'function') return mock.data;

  const context: MockContext = {
    params: match?.params ?? {},
    query: getQuery(event),
    event,
  };

  return await (mock.data as (context: MockContext) => unknown)(context);
}
