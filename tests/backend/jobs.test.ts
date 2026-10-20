import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Database } from '../../server/database/client.ts';
import { createBoss } from '../../server/jobs/boss.ts';

// Il database non serve: pg-boss non si connette finché non si chiama `start()`
const db = {} as Database;

test('con Postgres la stringa di connessione è obbligatoria', () => {
  assert.throws(() => createBoss(db, { dialect: 'postgres', url: '' }), /NUXT_DATABASE_URL/);
});

test('con Postgres pg-boss si costruisce senza aprire connessioni', () => {
  assert.doesNotThrow(() => createBoss(db, { dialect: 'postgres', url: 'postgres://utente:password@localhost:1/db' }));
});
