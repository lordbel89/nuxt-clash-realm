import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { members, users } from '../../server/database/schema/index.ts';
import { addMember, createOrganization, removeMember, updateMemberRole } from '../../server/services/organizations.ts';
import { createTestPostgres } from '../support/postgres.ts';

const pg = await createTestPostgres();
after(() => pg.drop());

async function user(name: string) {
  const [row] = await pg.db.insert(users).values({ name, email: `${name.toLowerCase()}@example.com` }).returning({ id: users.id });
  return row!.id;
}

async function owners(organizationId: string) {
  const rows = await pg.db.select({ role: members.role, organizationId: members.organizationId }).from(members);
  return rows.filter(row => row.organizationId === organizationId && row.role === 'owner').length;
}

test('due owner che si declassano a vicenda insieme lasciano comunque un owner', async () => {
  for (let round = 0; round < 20; round++) {
    const [a, b] = [await user(`A${round}`), await user(`B${round}`)];
    const organization = await createOrganization(pg.db, a, { name: `Gara ${round}` });
    await addMember(pg.db, organization.id, { userId: b, role: 'owner' });

    const results = await Promise.all([
      updateMemberRole(pg.db, organization.id, a, 'admin'),
      updateMemberRole(pg.db, organization.id, b, 'admin'),
    ]);

    assert.deepEqual(results.map(result => result.ok).sort(), [false, true]);
    assert.equal(await owners(organization.id), 1);
  }
});

test('due owner che escono insieme lasciano comunque un owner', async () => {
  for (let round = 0; round < 20; round++) {
    const [a, b] = [await user(`C${round}`), await user(`D${round}`)];
    const organization = await createOrganization(pg.db, a, { name: `Uscita ${round}` });
    await addMember(pg.db, organization.id, { userId: b, role: 'owner' });

    const results = await Promise.all([
      removeMember(pg.db, organization.id, { userId: a, role: 'owner' }, a),
      removeMember(pg.db, organization.id, { userId: b, role: 'owner' }, b),
    ]);

    assert.deepEqual(results.map(result => result.ok).sort(), [false, true]);
    assert.equal(await owners(organization.id), 1);
  }
});

test('creazioni simultanee con lo stesso nome ricevono slug diversi', async () => {
  const creator = await user('Creatore');
  const created = await Promise.all(Array.from({ length: 5 }, () => createOrganization(pg.db, creator, { name: 'Stesso Nome' })));

  assert.equal(new Set(created.map(organization => organization.slug)).size, 5);
});
