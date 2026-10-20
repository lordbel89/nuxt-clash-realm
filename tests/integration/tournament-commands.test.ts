import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { PGlite } from '@electric-sql/pglite';
import { asc, eq } from 'drizzle-orm';
import { closeDatabase } from '../../server/database/client.ts';
import { historyEntries, tournaments, users } from '../../server/database/schema/index.ts';
import { TOURNAMENT_CHANNEL, type TournamentNotification } from '../../server/realtime/events.ts';
import { createOrganization } from '../../server/services/organizations.ts';
import { runTournamentCommand, TournamentNotFoundError } from '../../server/services/tournament-commands.ts';
import { createTournament, updateTournament } from '../../server/services/tournaments.ts';
import { validate } from '../../server/utils/validation.ts';
import { CreateTournamentInput, UpdateTournamentInput } from '../../shared/schemas/tournament.ts';
import type { TournamentId } from '../../shared/types/ids.ts';
import { createTestDatabase } from '../support/database.ts';

const db = await createTestDatabase();
after(() => closeDatabase(db));

const [mario] = await db.insert(users).values({ name: 'Mario', email: 'mario@example.com' }).returning({ id: users.id });
const shop = await createOrganization(db, mario!.id, { name: 'Negozio Rossi' });
const actorId = mario!.id;

// Le notifiche arrivano su una connessione in ascolto, come farà il notifier (F0.9)
const notifications: TournamentNotification[] = [];
await (db.$client as PGlite).listen(TOURNAMENT_CHANNEL, payload => notifications.push(JSON.parse(payload)));

function create(fields: Record<string, unknown> = {}) {
  return createTournament(db, actorId, validate(CreateTournamentInput, { organizationId: shop.id, name: 'Open', game: 'Magic', ...fields }));
}

const history = (tournamentId: TournamentId) =>
  db.select().from(historyEntries).where(eq(historyEntries.tournamentId, tournamentId)).orderBy(asc(historyEntries.id));

/** `pg_notify` consegna in modo asincrono: lascia girare il ciclo degli eventi prima di guardare. */
const settle = () => new Promise(resolve => setTimeout(resolve, 20));

test('se il comando riesce la voce c\'è, con attore, motivazione, prima e dopo', async () => {
  const { id } = await create();

  await runTournamentCommand(db, { tournamentId: id, actorId, reason: 'Errore di battitura' }, async ({ tx, record }) => {
    await tx.update(tournaments).set({ name: 'Open di novembre' }).where(eq(tournaments.id, id));
    record({ entity: 'tournament', entityId: id, action: 'renamed', before: { name: 'Open' }, after: { name: 'Open di novembre' } });
  });

  const [entry] = await history(id);
  assert.equal(entry?.tournamentId, id);
  assert.equal(entry?.entity, 'tournament');
  assert.equal(entry?.entityId, id);
  assert.equal(entry?.action, 'renamed');
  assert.equal(entry?.actorId, actorId);
  assert.equal(entry?.reason, 'Errore di battitura');
  assert.deepEqual(entry?.before, { name: 'Open' });
  assert.deepEqual(entry?.after, { name: 'Open di novembre' });
  assert.ok(entry?.at instanceof Date);
});

test('se il comando fallisce non resta niente: né modifica, né voce, né notifica', async () => {
  const { id } = await create();
  await settle();
  notifications.length = 0;

  await assert.rejects(
    runTournamentCommand(db, { tournamentId: id, actorId }, async ({ tx, record, emit }) => {
      await tx.update(tournaments).set({ name: 'Mai scritto' }).where(eq(tournaments.id, id));
      record({ entity: 'tournament', entityId: id, action: 'renamed' });
      emit({ type: 'tournament.updated' });
      throw new Error('boom');
    }),
    /boom/,
  );
  await settle();

  assert.deepEqual(await history(id), []);
  assert.equal((await db.select({ name: tournaments.name }).from(tournaments).where(eq(tournaments.id, id)))[0]?.name, 'Open');
  assert.deepEqual(notifications, []);
});

test('un atto rifiutato con un esito può lasciare comunque la sua voce', async () => {
  const { id } = await create();

  const outcome = await runTournamentCommand(db, { tournamentId: id, actorId }, async ({ record }) => {
    record({ entity: 'tournament', entityId: id, action: 'update_rejected', after: { name: 'Altro' } });
    return { ok: false } as const;
  });

  assert.deepEqual(outcome, { ok: false });
  assert.deepEqual((await history(id)).map(entry => entry.action), ['update_rejected']);
});

test('le voci di un comando restano nell\'ordine in cui sono state registrate', async () => {
  const { id } = await create();

  await runTournamentCommand(db, { tournamentId: id, actorId }, async ({ record }) => {
    for (const action of ['primo', 'secondo', 'terzo']) record({ entity: 'tournament', entityId: id, action });
  });
  await runTournamentCommand(db, { tournamentId: id, actorId }, async ({ record }) => {
    record({ entity: 'tournament', entityId: id, action: 'quarto' });
  });

  assert.deepEqual((await history(id)).map(entry => entry.action), ['primo', 'secondo', 'terzo', 'quarto']);
});

test('l\'evento parte al commit, con i soli identificativi', async () => {
  const { id } = await create();
  await settle();
  notifications.length = 0;

  await runTournamentCommand(db, { tournamentId: id, actorId }, async ({ emit }) => {
    emit({ type: 'tournament.updated' });
  });
  await settle();

  assert.deepEqual(notifications, [{ tournamentId: id, event: { type: 'tournament.updated' } }]);
});

test('un torneo inesistente non apre nessun comando', async () => {
  const missing = '00000000-0000-4000-8000-00000000ffff' as TournamentId;
  let called = false;

  await assert.rejects(
    runTournamentCommand(db, { tournamentId: missing, actorId }, async () => {
      called = true;
    }),
    TournamentNotFoundError,
  );
  assert.equal(called, false);
});

test('la modifica di un torneo lascia una voce con i soli campi cambiati, e l\'evento', async () => {
  const { id } = await create({ maxParticipants: 16, description: 'Prima' });
  await settle();
  notifications.length = 0;

  const result = await updateTournament(db, id, actorId, validate(UpdateTournamentInput, { name: 'Open rinominato', description: 'Prima', maxParticipants: 32 }));
  await settle();

  assert.ok(result.ok);
  const [entry] = await history(id);
  assert.equal(entry?.action, 'updated');
  assert.equal(entry?.actorId, actorId);
  assert.deepEqual(entry?.before, { name: 'Open', maxParticipants: 16 });
  assert.deepEqual(entry?.after, { name: 'Open rinominato', maxParticipants: 32 });
  assert.deepEqual(notifications, [{ tournamentId: id, event: { type: 'tournament.updated' } }]);
});

test('una modifica che non cambia niente non lascia voci né eventi', async () => {
  const { id } = await create({ description: 'Uguale' });
  await settle();
  notifications.length = 0;

  const result = await updateTournament(db, id, actorId, validate(UpdateTournamentInput, { name: 'Open', description: 'Uguale' }));
  await settle();

  assert.ok(result.ok);
  assert.deepEqual(await history(id), []);
  assert.deepEqual(notifications, []);
});

test('un torneo concluso rifiuta la modifica senza lasciare voci', async () => {
  const { id } = await create();
  await db.update(tournaments).set({ status: 'finished' }).where(eq(tournaments.id, id));

  assert.deepEqual(await updateTournament(db, id, actorId, { name: 'Troppo tardi' }), { ok: false, reason: 'closed' });
  assert.deepEqual(await history(id), []);
});
