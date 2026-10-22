import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { eq, sql } from 'drizzle-orm';
import { fromDrizzle } from 'pg-boss';
import { users } from '../../server/database/schema/index.ts';
import { startBoss, stopBoss } from '../../server/jobs/boss.ts';
import { createTestPostgres } from '../support/postgres.ts';

const pg = await createTestPostgres();
const options = { dialect: 'postgres', url: pg.url } as const;
const boss = await startBoss(pg.db, options);
after(async () => {
  await stopBoss(boss);
  await pg.drop();
});

let queueCount = 0;
async function newQueue() {
  const name = `prova-${++queueCount}`;
  await boss.createQueue(name);
  return name;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test('un job accodato in una transazione con commit esiste', async () => {
  const queue = await newQueue();

  const id = await pg.db.transaction(async tx => await boss.send(queue, { n: 1 }, { db: fromDrizzle(tx, sql) }));

  assert.ok(id);
  assert.ok(await boss.getJobById(queue, id));
});

test('un job accodato in una transazione annullata non esiste', async () => {
  const queue = await newQueue();
  let id: string | null = null;

  await assert.rejects(pg.db.transaction(async (tx) => {
    id = await boss.send(queue, { n: 1 }, { db: fromDrizzle(tx, sql) });
    assert.ok(id, 'dentro la transazione il job è stato accodato');
    throw new Error('annullata');
  }), /annullata/);

  assert.equal(await boss.getJobById(queue, id!), null);
  assert.deepEqual(await boss.fetch(queue), []);
});

test('la modifica e il job vivono o muoiono insieme', async () => {
  const queue = await newQueue();

  await pg.db.transaction(async (tx) => {
    await tx.insert(users).values({ name: 'Salvato', email: 'salvato@example.com' });
    await boss.send(queue, { email: 'salvato@example.com' }, { db: fromDrizzle(tx, sql) });
  });
  await assert.rejects(pg.db.transaction(async (tx) => {
    await tx.insert(users).values({ name: 'Perso', email: 'perso@example.com' });
    await boss.send(queue, { email: 'perso@example.com' }, { db: fromDrizzle(tx, sql) });
    throw new Error('annullata');
  }));

  assert.equal((await pg.db.select().from(users).where(eq(users.email, 'perso@example.com'))).length, 0);
  const jobs = await boss.fetch<{ email: string; }>(queue, { batchSize: 10 });
  assert.deepEqual(jobs.map(job => job.data.email), ['salvato@example.com']);
});

test('senza fromDrizzle il job non segue la transazione: sopravvive all\'annullamento', async () => {
  const queue = await newQueue();
  let id: string | null = null;

  await assert.rejects(pg.db.transaction(async () => {
    id = await boss.send(queue, { n: 1 });
    throw new Error('annullata');
  }));

  assert.ok(id);
  assert.ok(await boss.getJobById(queue, id));
});

test('due istanze di pg-boss sulla stessa coda lavorano ogni job una volta sola', async () => {
  const queue = await newQueue();
  const other = await startBoss(pg.db, options);
  const done: number[] = [];
  const handler = async (jobs: { data: { n: number; }; }[]) => {
    for (const job of jobs) done.push(job.data.n);
  };

  try {
    await boss.work<{ n: number; }>(queue, { pollingIntervalSeconds: 0.5 }, handler);
    await other.work<{ n: number; }>(queue, { pollingIntervalSeconds: 0.5 }, handler);
    await Promise.all(Array.from({ length: 20 }, (_, n) => boss.send(queue, { n })));

    const deadline = Date.now() + 15_000;
    while (done.length < 20 && Date.now() < deadline) await sleep(100);
    await sleep(1500);

    assert.deepEqual(done.toSorted((a, b) => a - b), Array.from({ length: 20 }, (_, n) => n));
  }
  finally {
    await stopBoss(other);
  }
});

test('uno stop pulito lascia il database usabile', async () => {
  const other = await startBoss(pg.db, options);
  await stopBoss(other);

  assert.equal((await pg.db.execute(sql`SELECT 1 AS one`))[0]?.one, 1);
});
