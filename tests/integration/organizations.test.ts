import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { closeDatabase } from '../../server/database/client.ts';
import { users } from '../../server/database/schema/index.ts';
import {
  addMember,
  createOrganization,
  findMemberRole,
  listMembers,
  listOwnOrganizations,
  removeMember,
  updateMemberRole,
  updateOrganization,
} from '../../server/services/organizations.ts';
import { listUsers } from '../../server/services/users.ts';
import type { UserId } from '../../shared/types/ids.ts';
import { createTestDatabase } from '../support/database.ts';

const db = await createTestDatabase();
after(() => closeDatabase(db));

const page = { limit: 25, offset: 0 };

async function user(name: string, email: string) {
  const [row] = await db.insert(users).values({ name, email }).returning({ id: users.id });
  return row!.id;
}

const mario = await user('Mario Rossi', 'mario@example.com');
const giulia = await user('Giulia Bianchi', 'giulia@example.com');
const luca = await user('Luca Verdi', 'luca@example.com');
const estraneo = await user('Anna Neri', 'anna@example.com');

test('chi crea un\'organizzazione ne è owner; lo slug viene dal nome e non si ripete', async () => {
  const first = await createOrganization(db, mario, { name: 'Negozio Rossi' });
  const second = await createOrganization(db, giulia, { name: 'Negozio  Rossi!' });

  assert.equal(first.slug, 'negozio-rossi');
  assert.equal(first.myRole, 'owner');
  assert.equal(second.slug, 'negozio-rossi-2');
  assert.equal(await findMemberRole(db, first.id, mario), 'owner');
  assert.equal(await findMemberRole(db, first.id, giulia), null);
});

test('un owner aggiunge un admin, che vede l\'organizzazione con il suo ruolo', async () => {
  const organization = await createOrganization(db, mario, { name: 'Club del Venerdì' });

  const added = await addMember(db, organization.id, { userId: giulia, role: 'admin' });
  assert.ok(added.ok);
  assert.deepEqual(added.member.user, { id: giulia, name: 'Giulia Bianchi' });

  const own = await listOwnOrganizations(db, giulia, page);
  assert.deepEqual(own.items.find(item => item.id === organization.id)?.myRole, 'admin');

  const membersPage = await listMembers(db, organization.id, page);
  assert.deepEqual(membersPage.items.map(member => [member.user.name, member.role]), [['Mario Rossi', 'owner'], ['Giulia Bianchi', 'admin']]);
  assert.equal(membersPage.total, 2);
});

test('chi non è membro non ha ruolo: l\'organizzazione per lui non esiste', async () => {
  const organization = await createOrganization(db, mario, { name: 'Privata' });

  assert.equal(await findMemberRole(db, organization.id, estraneo), null);
  assert.equal((await listOwnOrganizations(db, estraneo, page)).total, 0);
});

test('un membro non si aggiunge due volte, e un utente inesistente non si aggiunge', async () => {
  const organization = await createOrganization(db, mario, { name: 'Doppioni' });
  await addMember(db, organization.id, { userId: giulia, role: 'admin' });

  assert.deepEqual(await addMember(db, organization.id, { userId: giulia, role: 'owner' }), { ok: false, reason: 'already_member' });
  assert.deepEqual(
    await addMember(db, organization.id, { userId: '00000000-0000-4000-8000-00000000ffff' as UserId, role: 'admin' }),
    { ok: false, reason: 'user_not_found' },
  );
});

test('l\'ultimo owner non si declassa e non esce; con due owner sì', async () => {
  const organization = await createOrganization(db, mario, { name: 'Un solo owner' });

  assert.deepEqual(await updateMemberRole(db, organization.id, mario, 'admin'), { ok: false, reason: 'last_owner' });
  assert.deepEqual(await removeMember(db, organization.id, { userId: mario, role: 'owner' }, mario), { ok: false, reason: 'last_owner' });

  await addMember(db, organization.id, { userId: luca, role: 'owner' });
  const demoted = await updateMemberRole(db, organization.id, mario, 'admin');
  assert.ok(demoted.ok);
  assert.equal(demoted.member.role, 'admin');
  assert.deepEqual(await removeMember(db, organization.id, { userId: luca, role: 'owner' }, luca), { ok: false, reason: 'last_owner' });
});

test('un admin toglie un admin ma non un owner; chiunque esce', async () => {
  const organization = await createOrganization(db, mario, { name: 'Pulizie' });
  await addMember(db, organization.id, { userId: giulia, role: 'admin' });
  await addMember(db, organization.id, { userId: luca, role: 'admin' });

  assert.deepEqual(await removeMember(db, organization.id, { userId: giulia, role: 'admin' }, mario), { ok: false, reason: 'forbidden' });
  assert.deepEqual(await removeMember(db, organization.id, { userId: giulia, role: 'admin' }, luca), { ok: true });
  assert.deepEqual(await removeMember(db, organization.id, { userId: giulia, role: 'admin' }, giulia), { ok: true });
  assert.deepEqual(await removeMember(db, organization.id, { userId: mario, role: 'owner' }, giulia), { ok: false, reason: 'not_member' });
  assert.equal((await listMembers(db, organization.id, page)).total, 1);
});

test('il nome cambia, lo slug no', async () => {
  const organization = await createOrganization(db, mario, { name: 'Vecchio nome' });
  const renamed = await updateOrganization(db, organization.id, 'owner', { name: 'Nuovo nome' });

  assert.equal(renamed?.name, 'Nuovo nome');
  assert.equal(renamed?.slug, 'vecchio-nome');
});

test('la rubrica trova il nome per sottostringa e l\'email solo per intero', async () => {
  const names = async (search?: string) => (await listUsers(db, { ...page, search })).items.map(item => item.name);

  assert.deepEqual(await names('ross'), ['Mario Rossi']);
  assert.deepEqual(await names('ROSS'), ['Mario Rossi']);
  assert.deepEqual(await names('Giulia@Example.com'), ['Giulia Bianchi']);
  assert.deepEqual(await names('giulia@example'), []);
  assert.deepEqual(await names('%'), []);
  assert.equal((await listUsers(db, { ...page, search: 'example.com' })).total, 0);
  assert.equal((await listUsers(db, page)).total, 4);
});
