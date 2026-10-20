import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { sql } from 'drizzle-orm';
import { users } from '../../server/database/schema/index.ts';
import { createTestPostgres } from '../support/postgres.ts';

const pg = await createTestPostgres();
after(() => pg.drop());

test('il database di test parte vuoto con lo schema migrato', async () => {
  assert.equal(await pg.db.$count(users), 0);
});

test('due transazioni sulla stessa riga si serializzano con FOR UPDATE', async () => {
  const [user] = await pg.db.insert(users).values({ email: 'mario@example.com', name: 'Mario' }).returning({ id: users.id });
  const order: string[] = [];

  // La prima prende il lock e lo tiene finché la seconda non è partita davvero
  let releaseFirst!: () => void;
  const firstHolds = new Promise<void>(resolve => (releaseFirst = resolve));
  let firstLocked!: () => void;
  const lockTaken = new Promise<void>(resolve => (firstLocked = resolve));

  const first = pg.db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM users WHERE id = ${user!.id} FOR UPDATE`);
    firstLocked();
    await firstHolds;
    order.push('first');
  });

  await lockTaken;

  const second = pg.db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM users WHERE id = ${user!.id} FOR UPDATE`);
    order.push('second');
  });

  // Se il lock non tenesse, la seconda finirebbe in questo intervallo
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.deepEqual(order, []);

  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(order, ['first', 'second']);
});
