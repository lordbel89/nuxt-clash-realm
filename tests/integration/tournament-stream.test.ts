import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { closeDatabase } from '../../server/database/client.ts';
import { users } from '../../server/database/schema/index.ts';
import { type ListenSource, listenSourceOf, startNotifier } from '../../server/realtime/notifier.ts';
import { pipeTournamentEvents, type StreamMessage } from '../../server/realtime/stream.ts';
import { createOrganization } from '../../server/services/organizations.ts';
import { runTournamentCommand } from '../../server/services/tournament-commands.ts';
import { createTournament, updateTournament } from '../../server/services/tournaments.ts';
import { validate } from '../../server/utils/validation.ts';
import { CreateTournamentInput } from '../../shared/schemas/tournament.ts';
import type { TournamentId } from '../../shared/types/ids.ts';
import { createTestDatabase } from '../support/database.ts';

const db = await createTestDatabase();
const notifier = await startNotifier(listenSourceOf(db));
after(async () => {
  await notifier.stop();
  await closeDatabase(db);
});

const [mario] = await db.insert(users).values({ name: 'Mario', email: 'mario@example.com' }).returning({ id: users.id });
const actorId = mario!.id;
const shop = await createOrganization(db, actorId, { name: 'Negozio Rossi' });

const create = () => createTournament(db, actorId, validate(CreateTournamentInput, { organizationId: shop.id, name: 'Open', game: 'Magic' }));

const NOW = new Date('2026-11-29T09:00:00.000Z');
const settle = () => new Promise(resolve => setTimeout(resolve, 20));

/** Un flusso collegato al notifier che raccoglie i messaggi in un elenco. */
function openStream(tournamentId: TournamentId, keepAliveMs?: number) {
  const messages: StreamMessage[] = [];
  const close = pipeTournamentEvents(notifier, tournamentId, message => void messages.push(message), { now: () => NOW, keepAliveMs });
  return { messages, close };
}

test('alla connessione il server manda hello con la propria ora', async () => {
  const { id } = await create();
  const stream = openStream(id);

  assert.deepEqual(stream.messages, [{ event: 'hello', data: JSON.stringify({ now: '2026-11-29T09:00:00.000Z' }) }]);
  stream.close();
});

test('un comando che riesce produce un evento sul flusso del suo torneo', async () => {
  const { id } = await create();
  const other = await create();
  const stream = openStream(id);
  const otherStream = openStream(other.id);

  await updateTournament(db, id, actorId, { name: 'Open rinominato' });
  await settle();

  assert.deepEqual(stream.messages.map(message => message.event), ['hello', 'tournament.updated']);
  assert.deepEqual(JSON.parse(stream.messages[1]!.data), { tournamentId: id });
  assert.deepEqual(otherStream.messages.map(message => message.event), ['hello']);
  stream.close();
  otherStream.close();
});

test('un comando fallito o che non cambia niente non produce eventi', async () => {
  const { id } = await create();
  const stream = openStream(id);

  await assert.rejects(runTournamentCommand(db, { tournamentId: id, actorId }, async ({ emit }) => {
    emit({ type: 'tournament.updated' });
    throw new Error('boom');
  }));
  await updateTournament(db, id, actorId, { name: 'Open' });
  await settle();

  assert.deepEqual(stream.messages.map(message => message.event), ['hello']);
  stream.close();
});

test('chiuso il flusso non arriva più niente', async () => {
  const { id } = await create();
  const stream = openStream(id);
  stream.close();

  await updateTournament(db, id, actorId, { name: 'Dopo la chiusura' });
  await settle();

  assert.deepEqual(stream.messages.map(message => message.event), ['hello']);
});

test('ogni client riceve il proprio evento', async () => {
  const { id } = await create();
  const [a, b] = [openStream(id), openStream(id)];

  await updateTournament(db, id, actorId, { name: 'Per tutti' });
  await settle();

  for (const stream of [a, b]) assert.deepEqual(stream.messages.map(message => message.event), ['hello', 'tournament.updated']);
  a.close();
  b.close();
});

test('il ping tiene viva la connessione quando non succede niente', async () => {
  const { id } = await create();
  const stream = openStream(id, 10);

  await new Promise(resolve => setTimeout(resolve, 55));
  stream.close();
  const count = stream.messages.length;
  await new Promise(resolve => setTimeout(resolve, 30));

  assert.ok(stream.messages.filter(message => message.event === 'ping').length >= 2);
  assert.equal(stream.messages.length, count, 'chiuso il flusso, i ping si fermano');
});

test('un flusso che non riesce a scrivere non ferma gli altri', async () => {
  const { id } = await create();
  const healthy = openStream(id);
  const broken = pipeTournamentEvents(notifier, id, () => {
    throw new Error('connessione caduta');
  });

  await updateTournament(db, id, actorId, { name: 'Nonostante tutto' });
  await settle();

  assert.deepEqual(healthy.messages.map(message => message.event), ['hello', 'tournament.updated']);
  broken();
  healthy.close();
});

test('se la connessione cade e torna, i client ricevono un nuovo hello', async () => {
  // Una sorgente finta: `reconnect()` simula il driver che riapre l'ascolto dopo una caduta
  let onListen!: () => void;
  const source: ListenSource = async (_channel, _onPayload, listened) => {
    onListen = listened;
    listened();
    return async () => {};
  };
  const flaky = await startNotifier(source);
  const messages: StreamMessage[] = [];
  const tournamentId = '00000000-0000-4000-8000-000000000001' as TournamentId;
  const close = pipeTournamentEvents(flaky, tournamentId, message => void messages.push(message), { now: () => NOW });

  onListen();

  assert.deepEqual(messages.map(message => message.event), ['hello', 'hello']);
  close();
  await flaky.stop();
});

test('un payload che non è nostro non ferma l\'ascolto', async () => {
  let deliver!: (payload: string) => void;
  const source: ListenSource = async (_channel, onPayload, listened) => {
    deliver = onPayload;
    listened();
    return async () => {};
  };
  const tolerant = await startNotifier(source);
  const tournamentId = '00000000-0000-4000-8000-000000000001' as TournamentId;
  const received: unknown[] = [];
  const unsubscribe = tolerant.subscribe(tournamentId, message => received.push(message));

  for (const payload of ['non json', '{}', 'null', '{"tournamentId":1}']) deliver(payload);
  deliver(JSON.stringify({ tournamentId, event: { type: 'tournament.updated' } }));

  assert.deepEqual(received, [{ type: 'tournament.updated' }]);
  unsubscribe();
  await tolerant.stop();
});
