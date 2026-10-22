import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { sql } from 'drizzle-orm';
import { users } from '../../server/database/schema/index.ts';
import { listenSourceOf, type NotifierMessage, startNotifier } from '../../server/realtime/notifier.ts';
import { createOrganization } from '../../server/services/organizations.ts';
import { runTournamentCommand } from '../../server/services/tournament-commands.ts';
import { createTournament } from '../../server/services/tournaments.ts';
import { validate } from '../../server/utils/validation.ts';
import { CreateTournamentInput } from '../../shared/schemas/tournament.ts';
import { createTestPostgres } from '../support/postgres.ts';

const pg = await createTestPostgres();
const notifier = await startNotifier(listenSourceOf(pg.db));
after(async () => {
  await notifier.stop();
  await pg.drop();
});

const [mario] = await pg.db.insert(users).values({ name: 'Mario', email: 'mario@example.com' }).returning({ id: users.id });
const actorId = mario!.id;
const shop = await createOrganization(pg.db, actorId, { name: 'Negozio Rossi' });
const { id } = await createTournament(pg.db, actorId, validate(CreateTournamentInput, { organizationId: shop.id, name: 'Open', game: 'Magic' }));

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(condition: () => boolean, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (!condition() && Date.now() < deadline) await sleep(50);
}

const received: NotifierMessage[] = [];
notifier.subscribe(id, message => received.push(message));

test('su Postgres l\'evento arriva al commit, non prima', async () => {
  received.length = 0;

  const command = runTournamentCommand(pg.db, { tournamentId: id, actorId }, async ({ emit }) => {
    emit({ type: 'tournament.updated' });
    await sleep(300);
  });
  await sleep(150);
  assert.deepEqual(received, [], 'a transazione aperta non è arrivato niente');

  await command;
  await waitFor(() => received.length > 0);
  assert.deepEqual(received, [{ type: 'tournament.updated' }]);
});

test('se la connessione di ascolto cade e torna, gli iscritti ricevono resync e gli eventi riprendono', async () => {
  received.length = 0;

  // Chiude il backend che sta in LISTEN: postgres-js lo riapre da solo
  await pg.db.execute(sql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND query ILIKE 'listen%' AND pid <> pg_backend_pid()`);
  await waitFor(() => received.some(message => message.type === 'resync'));
  assert.deepEqual(received.filter(message => message.type === 'resync'), [{ type: 'resync' }]);

  received.length = 0;
  await runTournamentCommand(pg.db, { tournamentId: id, actorId }, async ({ emit }) => {
    emit({ type: 'tournament.updated' });
  });
  await waitFor(() => received.length > 0);
  assert.deepEqual(received, [{ type: 'tournament.updated' }]);
});
