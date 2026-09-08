import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toUser, toUserSummary } from '../../server/mappers/user.ts';
import { ListQuery, MAX_LIMIT, MAX_OFFSET } from '../../shared/schemas/common.ts';
import { UserIdParams } from '../../shared/schemas/user.ts';
import { validate } from '../../server/utils/validation.ts';
import type { UserId } from '../../shared/types/ids.ts';

const row = {
  id: '00000000-0000-4000-8000-000000000001' as UserId,
  name: 'Mario',
  email: 'mario@example.com',
  emailVerified: false,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  bannedAt: null,
  banReason: 'Riservato',
  password: 'Non deve uscire',
  futurePrivateColumn: 'Non deve uscire',
};

test('la rubrica espone solo id e nome anche se la sorgente contiene dati privati', () => {
  assert.deepEqual(toUserSummary(row), { id: row.id, name: row.name });
});

test('il proprio account serializza la data ed esclude colonne extra e amministrative', () => {
  assert.deepEqual(toUser(row), {
    id: row.id, name: row.name, email: row.email, emailVerified: false,
    isActive: true, createdAt: '2026-01-01T00:00:00.000Z',
  });
});

test('paginazione: default e limiti inclusivi', () => {
  assert.deepEqual(validate(ListQuery, {}), { limit: 25, offset: 0 });
  assert.deepEqual(validate(ListQuery, { limit: String(MAX_LIMIT), offset: String(MAX_OFFSET) }), { limit: MAX_LIMIT, offset: MAX_OFFSET });
});

test('paginazione: rifiuta coercizioni ambigue, ripetizioni e valori fuori intervallo', () => {
  for (const limit of ['', ' ', '0x10', '1e2', '1.5', '-1', '0', '101', ['1', '2'], null, 10]) {
    assert.throws(() => validate(ListQuery, { limit }), { statusCode: 400 });
  }
  assert.throws(() => validate(ListQuery, { offset: String(MAX_OFFSET + 1) }), { statusCode: 400 });
});

test('gli errori distinguono campi e radice e mantengono il payload senza un secondo data', () => {
  assert.throws(() => validate(UserIdParams, {}), (error: unknown) => {
    const actual = error as { statusCode: number; data: { fields: Record<string, string[]>; data?: unknown; }; };
    assert.equal(actual.statusCode, 400);
    assert.deepEqual(actual.data.fields.id, ['Identificativo utente richiesto']);
    assert.equal(actual.data.data, undefined);
    return true;
  });
  assert.throws(() => validate(UserIdParams, null), (error: unknown) => {
    assert.deepEqual((error as { data: { messages: string[]; }; }).data.messages, ['Identificativo utente richiesto']);
    return true;
  });
  assert.deepEqual(validate(UserIdParams, { id: row.id }), { id: row.id });
  assert.throws(() => validate(UserIdParams, { id: 'non-uuid' }), { statusCode: 400 });
});
