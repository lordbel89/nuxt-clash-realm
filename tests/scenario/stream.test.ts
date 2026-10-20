import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { signIn, startTestServer, type TestServer, type TestSession } from '../support/server.ts';

const password = 'una-password-lunga';
const users = {
  mario: { email: 'mario@example.com', name: 'Mario Rossi', password },
  anna: { email: 'anna@example.com', name: 'Anna Neri', password },
};

let server: TestServer;
let mario: TestSession;
let anna: TestSession;

before(async () => {
  server = await startTestServer({ users: Object.values(users) });
  [mario, anna] = await Promise.all([
    signIn(server, users.mario.email, password),
    signIn(server, users.anna.email, password),
  ]);
});
after(() => server?.stop());

const json = (body: unknown) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** Legge il flusso SSE finché `done` non è soddisfatta; poi lo chiude. */
async function readEvents(response: Response, done: (events: string[]) => boolean, timeoutMs = 10_000) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const events: string[] = [];
  let buffer = '';
  const deadline = Date.now() + timeoutMs;

  while (!done(events) && Date.now() < deadline) {
    const chunk = await Promise.race([
      reader.read(),
      new Promise<null>(resolve => setTimeout(() => resolve(null), Math.max(0, deadline - Date.now()))),
    ]);
    if (!chunk || chunk.done) break;

    buffer += decoder.decode(chunk.value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop()!;
    for (const block of blocks) events.push(block);
  }

  await reader.cancel();
  return events;
}

test('il flusso di un torneo manda hello e poi l\'evento quando il torneo cambia', async () => {
  const organization = await (await mario.fetch('/api/organizations', { method: 'POST', ...json({ name: 'Ludoteca' }) })).json();
  const tournament = await (await mario.fetch('/api/tournaments', {
    method: 'POST',
    ...json({ organizationId: organization.id, name: 'Open di Natale', game: 'Magic' }),
  })).json();

  // Una bozza non si ascolta da fuori: stessa regola della lettura
  assert.equal((await fetch(`${server.url}/api/tournaments/${tournament.id}/stream`)).status, 404);
  assert.equal((await anna.fetch(`/api/tournaments/${tournament.id}/stream`)).status, 404);

  const response = await mario.fetch(`/api/tournaments/${tournament.id}/stream`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^text\/event-stream/);
  assert.equal(response.headers.get('x-accel-buffering'), 'no');

  // L'evento si produce mentre il flusso è già aperto
  const reading = readEvents(response, events => events.some(event => event.includes('event: tournament.updated')));
  await new Promise(resolve => setTimeout(resolve, 300));
  const renamed = await mario.fetch(`/api/tournaments/${tournament.id}`, { method: 'PATCH', ...json({ name: 'Open di Natale 2026' }) });
  assert.equal(renamed.status, 200);

  const events = await reading;
  assert.match(events[0]!, /^event: hello\ndata: \{"now":"\d{4}-\d\d-\d\dT[\d:.]+Z"\}$/);
  assert.equal(events[1], `event: tournament.updated\ndata: {"tournamentId":"${tournament.id}"}`);
});
