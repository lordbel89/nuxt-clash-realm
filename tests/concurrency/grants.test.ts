import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import postgres from 'postgres';
import { applyGrants } from '../../server/database/grants.ts';
import { historyEntries, tournaments, users } from '../../server/database/schema/index.ts';
import { createOrganization } from '../../server/services/organizations.ts';
import { createTournament, updateTournament } from '../../server/services/tournaments.ts';
import { validate } from '../../server/utils/validation.ts';
import { CreateTournamentInput } from '../../shared/schemas/tournament.ts';
import { createTestPostgres } from '../support/postgres.ts';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { relations } from '../../server/database/relations.ts';
import type { Database } from '../../server/database/client.ts';

// Il database di test è del superutente `clash`, che qui fa da owner. Il ruolo dell'app è nuovo,
// con un nome casuale: i ruoli sono dell'intero server, non del database.
const pg = await createTestPostgres();
const role = `app_${Math.random().toString(36).slice(2, 10)}`;
const password = 'app-password';
const owner = postgres(pg.url, { max: 1, onnotice: () => {} });
await owner.unsafe(`CREATE ROLE ${role} LOGIN PASSWORD '${password}'`);
await applyGrants(owner, role);

const appUrl = new URL(pg.url);
appUrl.username = role;
appUrl.password = password;
const appClient = postgres(appUrl.href, { max: 2, onnotice: () => {} });
const appDb = drizzle({ client: appClient, relations }) as unknown as Database;

after(async () => {
  await appClient.end();
  await owner.end();
  await pg.drop();
  const admin = postgres(new URL('/postgres', pg.url).href, { max: 1 });
  await admin.unsafe(`DROP ROLE IF EXISTS ${role}`);
  await admin.end();
});

const [mario] = await pg.db.insert(users).values({ name: 'Mario', email: 'mario@example.com' }).returning({ id: users.id });
const actorId = mario!.id;

async function denied(query: string) {
  await assert.rejects(appClient.unsafe(query), /permission denied|must be owner/, query);
}

test('l\'app lavora normalmente: crea, modifica, e lo storico si scrive', async () => {
  const shop = await createOrganization(appDb, actorId, { name: 'Negozio Rossi' });
  const { id } = await createTournament(appDb, actorId, validate(CreateTournamentInput, { organizationId: shop.id, name: 'Open', game: 'Magic' }));

  const result = await updateTournament(appDb, id, actorId, { name: 'Open rinominato' });

  assert.ok(result.ok);
  assert.equal((await appDb.select().from(historyEntries).where(eq(historyEntries.tournamentId, id))).length, 1);
  assert.equal((await appDb.select().from(tournaments).where(eq(tournaments.id, id)))[0]?.name, 'Open rinominato');
});

test('lo storico si legge e si aggiunge, ma non si riscrive', async () => {
  await appClient.unsafe('SELECT * FROM history_entries');
  await denied('UPDATE history_entries SET action = \'x\'');
  await denied('DELETE FROM history_entries');
  await denied('TRUNCATE history_entries');
});

test('l\'app non cambia lo schema né vede il registro delle migrazioni', async () => {
  await denied('CREATE TABLE abusiva (id int)');
  await denied('DROP TABLE tournaments');
  await denied('SELECT * FROM drizzle.__drizzle_migrations');
});

test('le tabelle create dopo una migrazione prendono i permessi al giro successivo', async () => {
  await owner.unsafe('CREATE TABLE nuova (id int)');
  await denied('SELECT * FROM nuova');

  await applyGrants(owner, role);

  await appClient.unsafe('INSERT INTO nuova VALUES (1)');
  assert.equal((await appClient.unsafe('SELECT * FROM nuova')).length, 1);
});

test('applicare i permessi due volte non cambia niente', async () => {
  await applyGrants(owner, role);
  await applyGrants(owner, role);

  await denied('UPDATE history_entries SET action = \'x\'');
});

test('un ruolo che non esiste ferma il rilascio con un errore chiaro', async () => {
  await assert.rejects(applyGrants(owner, 'ruolo_inesistente_xyz'), /ruolo_inesistente_xyz/);
});
