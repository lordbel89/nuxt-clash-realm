import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { asc, eq } from 'drizzle-orm';
import { historyEntries, tournaments, users } from '../../server/database/schema/index.ts';
import { createOrganization } from '../../server/services/organizations.ts';
import { runTournamentCommand } from '../../server/services/tournament-commands.ts';
import { createTournament } from '../../server/services/tournaments.ts';
import { validate } from '../../server/utils/validation.ts';
import { CreateTournamentInput } from '../../shared/schemas/tournament.ts';
import { createTestPostgres } from '../support/postgres.ts';

const pg = await createTestPostgres();
after(() => pg.drop());

const [mario] = await pg.db.insert(users).values({ name: 'Mario', email: 'mario@example.com' }).returning({ id: users.id });
const actorId = mario!.id;
const shop = await createOrganization(pg.db, actorId, { name: 'Negozio Rossi' });

function create() {
  return createTournament(pg.db, actorId, validate(CreateTournamentInput, { organizationId: shop.id, name: 'Open', game: 'Magic', maxParticipants: 2 }));
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test('venti comandi paralleli sullo stesso torneo si serializzano: nessun aggiornamento si perde', async () => {
  const { id } = await create();

  // Ogni comando legge il valore dalla riga bloccata e scrive +1: senza il blocco ne vincerebbe uno solo
  await Promise.all(Array.from({ length: 20 }, () =>
    runTournamentCommand(pg.db, { tournamentId: id, actorId }, async ({ tx, tournament, record }) => {
      const next = tournament.maxParticipants! + 1;
      await sleep(5);
      await tx.update(tournaments).set({ maxParticipants: next }).where(eq(tournaments.id, id));
      record({ entity: 'tournament', entityId: id, action: 'incremented', before: { value: next - 1 }, after: { value: next } });
    })));

  const [row] = await pg.db.select({ maxParticipants: tournaments.maxParticipants }).from(tournaments).where(eq(tournaments.id, id));
  assert.equal(row?.maxParticipants, 22);

  // Le voci seguono l'ordine reale: ognuna parte da dove è arrivata la precedente
  const entries = await pg.db.select().from(historyEntries).where(eq(historyEntries.tournamentId, id)).orderBy(asc(historyEntries.id));
  assert.deepEqual(entries.map(entry => (entry.after as { value: number; }).value), Array.from({ length: 20 }, (_, n) => n + 3));
  assert.ok(entries.every((entry, n) => n === 0 || (entry.before as { value: number; }).value === (entries[n - 1]!.after as { value: number; }).value));
});

test('un comando in corso fa aspettare il successivo fino al commit', async () => {
  const { id } = await create();
  const log: string[] = [];

  const first = runTournamentCommand(pg.db, { tournamentId: id, actorId }, async () => {
    log.push('primo: dentro');
    await sleep(150);
    log.push('primo: fuori');
  });
  await sleep(30);
  const second = runTournamentCommand(pg.db, { tournamentId: id, actorId }, async () => {
    log.push('secondo: dentro');
  });
  await Promise.all([first, second]);

  assert.deepEqual(log, ['primo: dentro', 'primo: fuori', 'secondo: dentro']);
});

test('tornei diversi non si bloccano a vicenda', async () => {
  const [a, b] = [await create(), await create()];
  const log: string[] = [];

  const first = runTournamentCommand(pg.db, { tournamentId: a.id, actorId }, async () => {
    await sleep(150);
    log.push('a');
  });
  await sleep(30);
  await runTournamentCommand(pg.db, { tournamentId: b.id, actorId }, async () => {
    log.push('b');
  });
  await first;

  assert.deepEqual(log, ['b', 'a']);
});
