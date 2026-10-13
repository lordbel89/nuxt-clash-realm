import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { eq } from 'drizzle-orm';
import { closeDatabase } from '../../server/database/client.ts';
import { tournaments, users } from '../../server/database/schema/index.ts';
import { createOrganization } from '../../server/services/organizations.ts';
import { createTournament, findTournamentOrganization, findVisibleTournament, listTournaments, updateTournament } from '../../server/services/tournaments.ts';
import { validate } from '../../server/utils/validation.ts';
import { CreateTournamentInput, UpdateTournamentInput } from '../../shared/schemas/tournament.ts';
import type { OrganizationId, TournamentId, UserId } from '../../shared/types/ids.ts';
import { createTestDatabase } from '../support/database.ts';

const db = await createTestDatabase();
after(() => closeDatabase(db));

const page = { limit: 25, offset: 0 };

async function user(name: string) {
  const [row] = await db.insert(users).values({ name, email: `${name.toLowerCase()}@example.com` }).returning({ id: users.id });
  return row!.id;
}

const mario = await user('Mario');
const anna = await user('Anna');
const shop = await createOrganization(db, mario, { name: 'Negozio Rossi' });
const club = await createOrganization(db, anna, { name: 'Club Bianchi' });

function create(actorId: UserId, organizationId: OrganizationId, fields: Record<string, unknown> = {}) {
  return createTournament(db, actorId, validate(CreateTournamentInput, { organizationId, name: 'Open', game: 'Magic', ...fields }));
}

async function setStatus(id: TournamentId, status: 'published' | 'finished') {
  await db.update(tournaments).set({ status }).where(eq(tournaments.id, id));
}

test('un torneo nasce in bozza, con un seed crittografico da 256 bit che non esce sul filo', async () => {
  const tournament = await create(mario, shop.id, { startsAt: '2026-11-29T10:00', location: { name: 'Negozio Rossi' } });

  assert.equal(tournament.status, 'draft');
  assert.equal(tournament.startsAt, '2026-11-29T09:00:00.000Z');
  assert.equal(tournament.startsAtLocal, '2026-11-29T10:00');
  assert.deepEqual(tournament.organization, { id: shop.id, name: 'Negozio Rossi', slug: 'negozio-rossi' });
  assert.equal('seed' in tournament, false);

  const [stored] = await db.select({ seed: tournaments.seed, createdBy: tournaments.createdBy }).from(tournaments).where(eq(tournaments.id, tournament.id));
  assert.match(stored!.seed, /^[0-9a-f]{64}$/);
  assert.equal(stored!.createdBy, mario);
  assert.equal(await findTournamentOrganization(db, tournament.id), shop.id);
});

test('una bozza la vede solo l\'organizzazione; pubblicata la vedono tutti', async () => {
  const tournament = await create(mario, shop.id, { name: 'Bozza da pubblicare' });

  assert.ok(await findVisibleTournament(db, tournament.id, mario));
  assert.equal(await findVisibleTournament(db, tournament.id, anna), null);
  assert.equal(await findVisibleTournament(db, tournament.id, null), null);

  await setStatus(tournament.id, 'published');
  assert.ok(await findVisibleTournament(db, tournament.id, anna));
  assert.ok(await findVisibleTournament(db, tournament.id, null));
});

test('l\'elenco di un\'organizzazione mostra le bozze ai membri; quello generale solo i pubblici', async () => {
  const draft = await create(anna, club.id, { name: 'Bozza del club' });
  const published = await create(anna, club.id, { name: 'Pubblico del club' });
  await setStatus(published.id, 'published');

  const names = async (viewer: UserId | null, organizationId?: OrganizationId) =>
    (await listTournaments(db, viewer, { ...page, organizationId })).items.map(item => item.name);

  assert.deepEqual(await names(anna, club.id), ['Pubblico del club', 'Bozza del club']);
  assert.deepEqual(await names(mario, club.id), ['Pubblico del club']);
  assert.deepEqual(await names(null, club.id), ['Pubblico del club']);

  const everywhere = await names(null);
  assert.ok(everywhere.includes('Pubblico del club'));
  assert.ok(!everywhere.includes(draft.name));
  assert.equal((await listTournaments(db, anna, { ...page, organizationId: club.id })).total, 2);
});

test('la modifica cambia solo i campi presenti; il solo fuso mantiene l\'orario locale', async () => {
  const tournament = await create(mario, shop.id, { startsAt: '2026-11-29T10:00', maxParticipants: 16, description: 'Prima' });

  const moved = await updateTournament(db, tournament.id, validate(UpdateTournamentInput, { timezone: 'Europe/London' }));
  assert.ok(moved.ok);
  assert.equal(moved.tournament.startsAtLocal, '2026-11-29T10:00');
  assert.equal(moved.tournament.startsAt, '2026-11-29T10:00:00.000Z');
  assert.equal(moved.tournament.maxParticipants, 16);
  assert.equal(moved.tournament.description, 'Prima');

  const cleared = await updateTournament(db, tournament.id, validate(UpdateTournamentInput, { description: null, maxParticipants: null }));
  assert.ok(cleared.ok);
  assert.equal(cleared.tournament.description, null);
  assert.equal(cleared.tournament.maxParticipants, null);
});

test('un torneo concluso non si modifica; uno inesistente non si trova', async () => {
  const tournament = await create(mario, shop.id);
  await setStatus(tournament.id, 'finished');

  assert.deepEqual(await updateTournament(db, tournament.id, { name: 'Troppo tardi' }), { ok: false, reason: 'closed' });
  assert.deepEqual(
    await updateTournament(db, '00000000-0000-4000-8000-00000000ffff' as TournamentId, { name: 'Nessuno' }),
    { ok: false, reason: 'not_found' },
  );
});

test('il database rifiuta stati inventati e capienze sotto due', async () => {
  const tournament = await create(mario, shop.id);

  await assert.rejects(db.update(tournaments).set({ status: 'paused' as never }).where(eq(tournaments.id, tournament.id)));
  await assert.rejects(db.update(tournaments).set({ maxParticipants: 1 }).where(eq(tournaments.id, tournament.id)));
});
