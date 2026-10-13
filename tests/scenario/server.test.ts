import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startTestServer, type TestServer } from '../support/server.ts';

let server: TestServer;
before(async () => (server = await startTestServer()));
after(() => server?.stop());

test('senza sessione il proprio account risponde 401 con il messaggio in italiano', async () => {
  const response = await fetch(`${server.url}/api/users/me`);

  assert.equal(response.status, 401);
  assert.equal((await response.json()).message, 'Autenticazione richiesta');
});

test('i mock sono spenti: nessuna risposta porta l\'header dei dati finti', async () => {
  // /api/tournaments oggi esiste solo come mock
  const response = await fetch(`${server.url}/api/tournaments`, { redirect: 'manual' });

  assert.equal(response.headers.get('MOCK_DATA'), null);
});
