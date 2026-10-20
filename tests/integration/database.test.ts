import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { closeDatabase } from '../../server/database/client.ts';
import { users } from '../../server/database/schema/index.ts';
import { createTestDatabase } from '../support/database.ts';

const db = await createTestDatabase();
after(() => closeDatabase(db));

test('il database di test parte vuoto con lo schema migrato', async () => {
  assert.equal(await db.$count(users), 0);
});

test('i vincoli dello schema valgono anche su PGlite', async () => {
  await db.insert(users).values({ email: 'mario@example.com', name: 'Mario' });

  await assert.rejects(
    db.insert(users).values({ email: 'mario@example.com', name: 'Altro Mario' }),
    (error: Error & { cause?: { code?: string; }; }) => error.cause?.code === '23505',
  );
});

test('ogni file di test ha il proprio database', async () => {
  const other = await createTestDatabase();

  try {
    assert.equal(await other.$count(users), 0);
  }
  finally {
    await closeDatabase(other);
  }
});
