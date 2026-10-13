import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { signIn, startTestServer, type TestServer, type TestSession } from '../support/server.ts';

const password = 'una-password-lunga';
const users = {
  mario: { email: 'mario@example.com', name: 'Mario Rossi', password },
  giulia: { email: 'giulia@example.com', name: 'Giulia Bianchi', password },
  anna: { email: 'anna@example.com', name: 'Anna Neri', password },
};

let server: TestServer;
let mario: TestSession;
let giulia: TestSession;
let anna: TestSession;

before(async () => {
  server = await startTestServer({ users: Object.values(users) });
  [mario, giulia, anna] = await Promise.all([
    signIn(server, users.mario.email, password),
    signIn(server, users.giulia.email, password),
    signIn(server, users.anna.email, password),
  ]);
});
after(() => server?.stop());

const json = (body: unknown) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

test('un utente crea un\'organizzazione, trova un collega e lo aggiunge come admin', async () => {
  const created = await mario.fetch('/api/organizations', { method: 'POST', ...json({ name: 'Negozio Rossi' }) });
  assert.equal(created.status, 200);
  const organization = await created.json();
  assert.equal(organization.slug, 'negozio-rossi');
  assert.equal(organization.myRole, 'owner');

  const found = await (await mario.fetch('/api/users?search=bianc')).json();
  assert.deepEqual(found.items.map((item: { name: string; }) => item.name), ['Giulia Bianchi']);

  const added = await mario.fetch(`/api/organizations/${organization.id}/members`, {
    method: 'POST',
    ...json({ userId: found.items[0].id, role: 'admin' }),
  });
  assert.equal(added.status, 200);

  const seen = await (await giulia.fetch(`/api/organizations/${organization.id}`)).json();
  assert.equal(seen.myRole, 'admin');

  // Un admin non crea owner, e per chi non è membro l'organizzazione non esiste
  const annaId = (await (await giulia.fetch('/api/users?search=anna@example.com')).json()).items[0].id;
  const escalation = await giulia.fetch(`/api/organizations/${organization.id}/members`, {
    method: 'POST',
    ...json({ userId: annaId, role: 'owner' }),
  });
  assert.equal(escalation.status, 403);
  assert.equal((await anna.fetch(`/api/organizations/${organization.id}`)).status, 404);

  // L'ultimo owner non esce; l'admin sì
  const marioId = (await (await mario.fetch('/api/users/me')).json()).id;
  const giuliaId = found.items[0].id;
  const lastOwner = await mario.fetch(`/api/organizations/${organization.id}/members/${marioId}`, { method: 'DELETE' });
  assert.equal(lastOwner.status, 409);
  assert.equal((await lastOwner.json()).message, 'L\'organizzazione deve avere almeno un owner');
  assert.equal((await giulia.fetch(`/api/organizations/${organization.id}/members/${giuliaId}`, { method: 'DELETE' })).status, 204);
  assert.equal((await giulia.fetch(`/api/organizations/${organization.id}`)).status, 404);
});

test('un nome troppo corto risponde 400 con il messaggio sul campo', async () => {
  const response = await mario.fetch('/api/organizations', { method: 'POST', ...json({ name: 'x' }) });

  assert.equal(response.status, 400);
  assert.deepEqual((await response.json()).data.fields.name, ['Il nome deve avere almeno due caratteri']);
});

test('l\'organizzazione crea un torneo in bozza: fuori dall\'organizzazione non esiste', async () => {
  const organization = await (await mario.fetch('/api/organizations', { method: 'POST', ...json({ name: 'Ludoteca' }) })).json();

  const created = await mario.fetch('/api/tournaments', {
    method: 'POST',
    ...json({ organizationId: organization.id, name: 'Open di Natale', game: 'Magic', startsAt: '2026-12-20T15:00' }),
  });
  assert.equal(created.status, 200);
  const tournament = await created.json();
  assert.equal(tournament.status, 'draft');
  assert.equal(tournament.timezone, 'Europe/Rome');
  assert.equal(tournament.startsAt, '2026-12-20T14:00:00.000Z');

  // Senza sessione e da non membro, la bozza non c'è
  assert.equal((await fetch(`${server.url}/api/tournaments/${tournament.id}`)).status, 404);
  assert.equal((await anna.fetch(`/api/tournaments/${tournament.id}`)).status, 404);
  const anonymous = await (await fetch(`${server.url}/api/tournaments?organizationId=${organization.id}`)).json();
  assert.equal(anonymous.total, 0);

  // Chi non è dell'organizzazione non modifica; chi lo è sì
  const intrusion = await anna.fetch(`/api/tournaments/${tournament.id}`, { method: 'PATCH', ...json({ name: 'Mio' }) });
  assert.equal(intrusion.status, 404);
  const renamed = await mario.fetch(`/api/tournaments/${tournament.id}`, { method: 'PATCH', ...json({ name: 'Open di Natale 2026' }) });
  assert.equal((await renamed.json()).name, 'Open di Natale 2026');

  const own = await (await mario.fetch(`/api/tournaments?organizationId=${organization.id}`)).json();
  assert.deepEqual(own.items.map((item: { name: string; }) => item.name), ['Open di Natale 2026']);
});
