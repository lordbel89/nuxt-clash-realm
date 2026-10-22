import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { AccountError, createAccount } from '../../server/auth/accounts.ts';
import { createAuth } from '../../server/auth/index.ts';
import { closeDatabase } from '../../server/database/client.ts';
import { users } from '../../server/database/schema/index.ts';
import { createTestDatabase } from '../support/database.ts';

const db = await createTestDatabase();
const auth = createAuth(db, { secret: 'segreto-dei-test-di-integrazione', url: 'http://localhost:3010' });
after(() => closeDatabase(db));

test('un account creato a mano fa login con la sua password', async () => {
  const id = await createAccount(db, auth, { email: ' Mario.Rossi@Example.com ', name: 'Mario Rossi', password: 'una-password-lunga' });

  const result = await auth.api.signInEmail({ body: { email: 'mario.rossi@example.com', password: 'una-password-lunga' } });

  assert.equal(result.user.id, id);
  assert.equal(result.user.email, 'mario.rossi@example.com');
  assert.ok(result.token);
});

test('la password sbagliata non entra', async () => {
  await createAccount(db, auth, { email: 'giulia@example.com', name: 'Giulia', password: 'la-password-giusta' });

  await assert.rejects(auth.api.signInEmail({ body: { email: 'giulia@example.com', password: 'la-password-sbagliata' } }));
});

test('nessuno si iscrive da solo, nemmeno chiamando Better Auth dal server', async () => {
  await assert.rejects(
    auth.api.signUpEmail({ body: { email: 'intruso@example.com', name: 'Intruso', password: 'una-password-lunga' } }),
    (error: { body?: { code?: string; }; }) => error.body?.code === 'EMAIL_PASSWORD_SIGN_UP_DISABLED',
  );
});

test('dati non validi o email già presente: errore leggibile, nessuna riga scritta', async () => {
  const before = await db.$count(users);

  const cases = [
    { email: 'non-una-email', name: 'Mario', password: 'una-password-lunga' },
    { email: 'luca@example.com', name: 'L', password: 'una-password-lunga' },
    { email: 'luca@example.com', name: 'Luca', password: 'corta' },
    { email: 'MARIO.ROSSI@example.com', name: 'Un altro Mario', password: 'una-password-lunga' },
  ];

  for (const input of cases) {
    await assert.rejects(createAccount(db, auth, input), AccountError, JSON.stringify(input));
  }

  assert.equal(await db.$count(users), before);
});
