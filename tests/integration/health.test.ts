import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { closeDatabase } from '../../server/database/client.ts';
import { checkDatabase } from '../../server/services/health.ts';
import { createTestDatabase } from '../support/database.ts';

const db = await createTestDatabase();
after(() => closeDatabase(db));

test('con il database vivo il controllo passa', async () => {
  await checkDatabase(db);
});

test('un database che non risponde in tempo fa fallire il controllo', async () => {
  const hung = { execute: () => new Promise(() => {}) } as unknown as typeof db;

  await assert.rejects(checkDatabase(hung, 50), /non risponde entro 50 ms/);
});

test('un database che lancia fa fallire il controllo', async () => {
  const broken = { execute: () => Promise.reject(new Error('connessione rifiutata')) } as unknown as typeof db;

  await assert.rejects(checkDatabase(broken), /connessione rifiutata/);
});
