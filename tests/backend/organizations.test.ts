import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toOrganization, toOrganizationMember } from '../../server/mappers/organization.ts';
import { canAssignRole, canChangeRole, canRemoveMember, firstFreeSlug, slugify } from '../../server/services/organizations.ts';
import { escapeLike } from '../../server/services/users.ts';
import { AddOrganizationMemberInput, CreateOrganizationInput } from '../../shared/schemas/organization.ts';
import { UserListQuery } from '../../shared/schemas/user.ts';
import { validate } from '../../server/utils/validation.ts';
import type { OrganizationId, UserId } from '../../shared/types/ids.ts';

const owner = '00000000-0000-4000-8000-000000000001' as UserId;
const admin = '00000000-0000-4000-8000-000000000002' as UserId;
const otherAdmin = '00000000-0000-4000-8000-000000000003' as UserId;
const otherOwner = '00000000-0000-4000-8000-000000000004' as UserId;

test('solo un owner crea un owner; un admin aggiunge solo admin', () => {
  assert.equal(canAssignRole('owner', 'owner'), true);
  assert.equal(canAssignRole('owner', 'admin'), true);
  assert.equal(canAssignRole('admin', 'admin'), true);
  assert.equal(canAssignRole('admin', 'owner'), false);
});

test('cambiare un ruolo spetta a un owner', () => {
  assert.equal(canChangeRole('owner'), true);
  assert.equal(canChangeRole('admin'), false);
});

test('chiunque esce; un owner toglie chiunque; un admin toglie solo admin', () => {
  assert.equal(canRemoveMember({ userId: admin, role: 'admin' }, { userId: admin, role: 'admin' }), true);
  assert.equal(canRemoveMember({ userId: owner, role: 'owner' }, { userId: owner, role: 'owner' }), true);
  assert.equal(canRemoveMember({ userId: owner, role: 'owner' }, { userId: otherOwner, role: 'owner' }), true);
  assert.equal(canRemoveMember({ userId: owner, role: 'owner' }, { userId: admin, role: 'admin' }), true);
  assert.equal(canRemoveMember({ userId: admin, role: 'admin' }, { userId: otherAdmin, role: 'admin' }), true);
  assert.equal(canRemoveMember({ userId: admin, role: 'admin' }, { userId: owner, role: 'owner' }), false);
});

test('lo slug viene dal nome: minuscolo, senza accenti né simboli, al massimo 48 caratteri', () => {
  assert.equal(slugify('Negozio Rossì & Figli'), 'negozio-rossi-figli');
  assert.equal(slugify('  --Città del Gioco!!  '), 'citta-del-gioco');
  assert.equal(slugify('★★★'), '');
  assert.equal(slugify('a'.repeat(60)).length, 48);
  assert.equal(slugify(`${'a'.repeat(47)} b`), 'a'.repeat(47));
});

test('se lo slug è preso si numera dal 2', () => {
  assert.equal(firstFreeSlug('rossi', new Set()), 'rossi');
  assert.equal(firstFreeSlug('rossi', new Set(['rossi'])), 'rossi-2');
  assert.equal(firstFreeSlug('rossi', new Set(['rossi', 'rossi-2', 'rossi-4'])), 'rossi-3');
});

test('i mapper espongono solo i campi del contratto', () => {
  const row = {
    id: '00000000-0000-4000-8000-0000000000aa' as OrganizationId,
    name: 'Negozio Rossi',
    slug: 'negozio-rossi',
    createdAt: new Date('2026-10-01T10:00:00Z'),
    futuraColonna: 'non deve uscire',
  };
  assert.deepEqual(toOrganization(row, 'admin'), {
    id: row.id, name: 'Negozio Rossi', slug: 'negozio-rossi', createdAt: '2026-10-01T10:00:00.000Z', myRole: 'admin',
  });

  const member = { role: 'owner' as const, createdAt: row.createdAt, user: { id: owner, name: 'Mario', email: 'privata@example.com' } };
  assert.deepEqual(toOrganizationMember(member), {
    user: { id: owner, name: 'Mario' }, role: 'owner', joinedAt: '2026-10-01T10:00:00.000Z',
  });
});

test('gli input delle organizzazioni rifiutano nomi corti e ruoli inventati', () => {
  assert.deepEqual(validate(CreateOrganizationInput, { name: '  Negozio Rossi ' }), { name: 'Negozio Rossi' });
  assert.throws(() => validate(CreateOrganizationInput, { name: ' a ' }), { statusCode: 400 });
  assert.throws(() => validate(AddOrganizationMemberInput, { userId: owner, role: 'member' }), { statusCode: 400 });
  assert.throws(() => validate(AddOrganizationMemberInput, { userId: 'non-un-uuid', role: 'admin' }), { statusCode: 400 });
});

test('la ricerca chiede almeno due caratteri e tratta i jolly di ILIKE come testo', () => {
  assert.equal(validate(UserListQuery, { search: ' ro ' }).search, 'ro');
  assert.equal(validate(UserListQuery, {}).search, undefined);
  assert.throws(() => validate(UserListQuery, { search: 'r' }), { statusCode: 400 });
  assert.throws(() => validate(UserListQuery, { search: ['ro', 'ss'] }), { statusCode: 400 });
  assert.equal(escapeLike('100%_\\'), '100\\%\\_\\\\');
});
