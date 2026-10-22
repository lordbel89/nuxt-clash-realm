import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { eq, sql } from 'drizzle-orm';
import { fromDrizzle } from 'pg-boss';
import { closeDatabase } from '../../server/database/client.ts';
import { users } from '../../server/database/schema/index.ts';
import { startBoss, stopBoss } from '../../server/jobs/boss.ts';
import { createTestDatabase } from '../support/database.ts';

const db = await createTestDatabase();
const boss = await startBoss(db, { dialect: 'pglite', url: '' });
after(async () => {
  await stopBoss(boss);
  await closeDatabase(db);
});

let queueCount = 0;
async function newQueue() {
  const name = `prova-${++queueCount}`;
  await boss.createQueue(name);
  return name;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test('un job accodato fuori da una transazione si legge e si lavora', async () => {
  const queue = await newQueue();

  const id = await boss.send(queue, { tipo: 'prova' });
  const [job] = await boss.fetch<{ tipo: string; }>(queue);

  assert.equal(job?.id, id);
  assert.deepEqual(job?.data, { tipo: 'prova' });
});

test('un job accodato in una transazione con commit esiste', async () => {
  const queue = await newQueue();

  const id = await db.transaction(async tx => await boss.send(queue, { n: 1 }, { db: fromDrizzle(tx, sql) }));

  assert.ok(id);
  assert.ok(await boss.getJobById(queue, id));
});

test('un job accodato in una transazione annullata non esiste', async () => {
  const queue = await newQueue();
  let id: string | null = null;

  await assert.rejects(db.transaction(async (tx) => {
    id = await boss.send(queue, { n: 1 }, { db: fromDrizzle(tx, sql) });
    assert.ok(id, 'dentro la transazione il job è stato accodato');
    throw new Error('annullata');
  }), /annullata/);

  assert.equal(await boss.getJobById(queue, id!), null);
  assert.deepEqual(await boss.fetch(queue), []);
});

test('la modifica e il job vivono o muoiono insieme', async () => {
  const queue = await newQueue();
  const email = (name: string) => `${name}@example.com`;

  await db.transaction(async (tx) => {
    await tx.insert(users).values({ name: 'Salvato', email: email('salvato') });
    await boss.send(queue, { email: email('salvato') }, { db: fromDrizzle(tx, sql) });
  });
  await assert.rejects(db.transaction(async (tx) => {
    await tx.insert(users).values({ name: 'Perso', email: email('perso') });
    await boss.send(queue, { email: email('perso') }, { db: fromDrizzle(tx, sql) });
    throw new Error('annullata');
  }));

  assert.equal((await db.select().from(users).where(eq(users.email, email('salvato')))).length, 1);
  assert.equal((await db.select().from(users).where(eq(users.email, email('perso')))).length, 0);
  const jobs = await boss.fetch<{ email: string; }>(queue, { batchSize: 10 });
  assert.deepEqual(jobs.map(job => job.data.email), [email('salvato')]);
});

test('senza fromDrizzle il job non segue la transazione: su PGlite aspetta, e sopravvive all\'annullamento', async () => {
  const queue = await newQueue();
  let sent!: Promise<string | null>;

  await assert.rejects(db.transaction(async (tx) => {
    await tx.execute(sql`SELECT 1`);
    // Non si fa `await`: PGlite ha una connessione sola e il send aspetta la fine della transazione
    sent = boss.send(queue, { n: 1 });
    throw new Error('annullata');
  }));

  const id = await sent;
  assert.ok(id);
  assert.ok(await boss.getJobById(queue, id), 'il job esiste anche se la transazione è stata annullata');
});

test('un worker riceve i job accodati nella transazione, non quelli annullati', async () => {
  const queue = await newQueue();
  const received: number[] = [];
  await boss.work<{ n: number; }>(queue, { pollingIntervalSeconds: 0.5 }, async (jobs) => {
    for (const job of jobs) received.push(job.data.n);
  });

  await db.transaction(async tx => await boss.send(queue, { n: 1 }, { db: fromDrizzle(tx, sql) }));
  await assert.rejects(db.transaction(async (tx) => {
    await boss.send(queue, { n: 2 }, { db: fromDrizzle(tx, sql) });
    throw new Error('annullata');
  }));
  await db.transaction(async tx => await boss.send(queue, { n: 3 }, { db: fromDrizzle(tx, sql) }));

  const deadline = Date.now() + 8000;
  while (received.length < 2 && Date.now() < deadline) await sleep(100);

  assert.deepEqual(received.toSorted(), [1, 3]);
});

test('uno stop pulito lascia il database usabile', async () => {
  const other = await startBoss(db, { dialect: 'pglite', url: '' });
  await stopBoss(other);

  assert.deepEqual((await db.execute(sql`SELECT 1 AS one`)).rows, [{ one: 1 }]);
});
