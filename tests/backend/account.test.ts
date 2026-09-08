import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createError } from 'h3';
import type { Database } from '../../server/database/client.ts';
import type { UserId } from '../../shared/types/ids.ts';
import { findUserSummary, listUsers } from '../../server/services/users.ts';

const actorId = '00000000-0000-4000-8000-000000000001' as UserId;
const row = {
  id: actorId, name: 'Mario', email: 'mario@example.com',
  emailVerified: false, isActive: true, createdAt: new Date('2026-01-01T00:00:00Z'),
  banReason: 'Riservato',
};

test('elenco e dettaglio richiedono solo colonne pubbliche ed escludono extra dalla risposta', async () => {
  const db = {
    query: { users: {
      findMany: async (query: { columns: unknown; limit: number; offset: number; }) => {
        assert.deepEqual(query.columns, { id: true, name: true });
        assert.equal(query.limit, 25);
        assert.equal(query.offset, 0);
        return [row];
      },
      findFirst: async (query: { columns: unknown; where: unknown; }) => {
        assert.deepEqual(query.columns, { id: true, name: true });
        assert.deepEqual(query.where, { id: { eq: actorId } });
        return row;
      },
    } },
    $count: async () => 1,
  } as unknown as Database;
  assert.deepEqual(await listUsers(db, { limit: 25, offset: 0 }), {
    items: [{ id: actorId, name: 'Mario' }], total: 1, limit: 25, offset: 0,
  });
  assert.deepEqual(await findUserSummary(db, actorId), { id: actorId, name: 'Mario' });
});

test('/me verifica la sessione prima del database e ignora identità fornite dal client', async () => {
  let authenticated = false;
  let found = true;
  let databaseReads = 0;
  const replacements = {
    defineEventHandler: (handler: unknown) => handler,
    requireUserId: async () => {
      if (!authenticated) throw createError({ statusCode: 401 });
      return actorId;
    },
    useDatabase: async () => {
      databaseReads++;
      return { query: { users: { findFirst: async (query: { where: unknown; columns: Record<string, boolean>; }) => {
        assert.deepEqual(query.where, { id: { eq: actorId } });
        assert.equal(query.columns.banReason, undefined);
        return found ? row : undefined;
      } } } };
    },
    createError,
  };
  const originals = Object.getOwnPropertyDescriptors(globalThis);
  Object.assign(globalThis, replacements);
  try {
    const { default: handler } = await import('../../server/api/users/me.get.ts');
    const call = handler as unknown as (event: unknown) => Promise<unknown>;
    const event = { context: { params: { id: 'altro-utente' } }, query: { id: 'altro-utente' } };
    await assert.rejects(call(event), { statusCode: 401 });
    assert.equal(databaseReads, 0);
    authenticated = true;
    const result = await call(event) as { id: string; email: string; };
    assert.equal(result.id, actorId);
    assert.equal(result.email, row.email);
    found = false;
    await assert.rejects(call(event), { statusCode: 404 });
  }
  finally {
    for (const key of Object.keys(replacements)) {
      const descriptor = originals[key];
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
