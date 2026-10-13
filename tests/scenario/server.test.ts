import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { signIn, startTestServer, type TestServer } from '../support/server.ts';

const mario = { email: 'mario@example.com', name: 'Mario Rossi', password: 'una-password-lunga' };

let server: TestServer;
before(async () => (server = await startTestServer({ users: [mario] })));
after(() => server?.stop());

test('senza sessione il proprio account risponde 401 con il messaggio in italiano', async () => {
  const response = await fetch(`${server.url}/api/users/me`);

  assert.equal(response.status, 401);
  assert.equal((await response.json()).message, 'Autenticazione richiesta');
});

test('un utente creato a mano fa login e legge il proprio account', async () => {
  const session = await signIn(server, mario.email, mario.password);
  const response = await session.fetch('/api/users/me');

  assert.equal(response.status, 200);
  assert.equal((await response.json()).email, mario.email);
});

test('l\'iscrizione pubblica è spenta', async () => {
  const response = await fetch(`${server.url}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': server.url },
    body: JSON.stringify({ email: 'intruso@example.com', name: 'Intruso', password: 'una-password-lunga' }),
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'EMAIL_PASSWORD_SIGN_UP_DISABLED');
});

test('i mock sono spenti: nessuna risposta porta l\'header dei dati finti', async () => {
  // /api/tournaments oggi esiste solo come mock
  const response = await fetch(`${server.url}/api/tournaments`, { redirect: 'manual' });

  assert.equal(response.headers.get('MOCK_DATA'), null);
});
