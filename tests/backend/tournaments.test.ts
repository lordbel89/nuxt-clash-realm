import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toNewTournamentRow, toTournament, toTournamentSummary, toTournamentUpdate } from '../../server/mappers/tournament.ts';
import { validate } from '../../server/utils/validation.ts';
import { CreateTournamentInput, UpdateTournamentInput } from '../../shared/schemas/tournament.ts';
import type { OrganizationId, TournamentId, UserId } from '../../shared/types/ids.ts';

const organizationId = '00000000-0000-4000-8000-0000000000aa' as OrganizationId;
const creator = '00000000-0000-4000-8000-000000000001' as UserId;

const minimal = { organizationId, name: 'Open di Natale', game: 'Magic: the Gathering' };

test('creazione: default per fuso, data, posti, luogo e descrizione', () => {
  assert.deepEqual(validate(CreateTournamentInput, minimal), {
    ...minimal,
    description: null,
    timezone: 'Europe/Rome',
    startsAt: null,
    maxParticipants: null,
    location: null,
  });
});

test('il fuso è un nome IANA, riportato al nome canonico; gli offset fissi no', () => {
  assert.equal(validate(CreateTournamentInput, { ...minimal, timezone: 'europe/rome' }).timezone, 'Europe/Rome');
  for (const timezone of ['+01:00', 'Europe/Roma', '']) {
    assert.throws(() => validate(CreateTournamentInput, { ...minimal, timezone }), { statusCode: 400 }, timezone);
  }
});

test('l\'inizio è un orario locale senza fuso, in un giorno che esiste', () => {
  assert.equal(validate(CreateTournamentInput, { ...minimal, startsAt: '2026-11-29T10:00' }).startsAt, '2026-11-29T10:00');
  for (const startsAt of ['2026-11-29T10:00Z', '2026-11-29T10:00:00', '2026-11-29', '2026-02-30T10:00', '2026-13-01T10:00']) {
    assert.throws(() => validate(CreateTournamentInput, { ...minimal, startsAt }), { statusCode: 400 }, startsAt);
  }
});

test('testi facoltativi vuoti valgono null; posti fra 2 e 1024', () => {
  const input = validate(CreateTournamentInput, { ...minimal, description: '   ', location: { name: 'Negozio Rossi', position: '' } });
  assert.equal(input.description, null);
  assert.deepEqual(input.location, { name: 'Negozio Rossi', position: null });

  for (const maxParticipants of [1, 2.5, 1025, '16']) {
    assert.throws(() => validate(CreateTournamentInput, { ...minimal, maxParticipants }), { statusCode: 400 }, String(maxParticipants));
  }
});

test('la modifica distingue un campo assente da un campo svuotato', () => {
  assert.deepEqual(validate(UpdateTournamentInput, {}), {});
  assert.deepEqual(validate(UpdateTournamentInput, { startsAt: null, location: null }), { startsAt: null, location: null });
});

test('la riga nuova converte l\'orario locale nel fuso del torneo e nasce in bozza', () => {
  // Il 29 marzo 2026 alle 02:30 a Roma non esiste: diventa le 03:30
  const input = validate(CreateTournamentInput, { ...minimal, startsAt: '2026-03-29T02:30', location: { name: 'Negozio Rossi' } });
  const row = toNewTournamentRow(input, creator, 'ab'.repeat(32));

  assert.equal(row.startsAt?.toISOString(), '2026-03-29T01:30:00.000Z');
  assert.equal(row.status, 'draft');
  assert.equal(row.locationName, 'Negozio Rossi');
  assert.equal(row.locationPosition, null);
  assert.equal(row.createdBy, creator);
});

const row = {
  id: '00000000-0000-4000-8000-0000000000bb' as TournamentId,
  name: 'Open di Natale',
  game: 'Magic: the Gathering',
  status: 'draft' as const,
  timezone: 'Europe/Rome',
  startsAt: new Date('2026-11-29T09:00:00Z'),
  description: null,
  maxParticipants: 32,
  locationName: 'Negozio Rossi',
  locationPosition: null,
  createdAt: new Date('2026-10-13T10:00:00Z'),
  organization: { id: organizationId, name: 'Negozio Rossi', slug: 'negozio-rossi', createdAt: new Date() },
  seed: 'non deve uscire',
  createdBy: creator,
  ruleset: { non: 'deve uscire' },
};

test('il DTO espone l\'inizio come istante e come orario locale, mai seed né autore', () => {
  assert.deepEqual(toTournament(row), {
    id: row.id,
    name: 'Open di Natale',
    game: 'Magic: the Gathering',
    status: 'draft',
    organization: { id: organizationId, name: 'Negozio Rossi', slug: 'negozio-rossi' },
    timezone: 'Europe/Rome',
    startsAt: '2026-11-29T09:00:00.000Z',
    startsAtLocal: '2026-11-29T10:00',
    description: null,
    maxParticipants: 32,
    location: { name: 'Negozio Rossi', position: null },
    createdAt: '2026-10-13T10:00:00.000Z',
  });
  assert.deepEqual(Object.keys(toTournamentSummary(row)), ['id', 'name', 'game', 'status', 'organization', 'timezone', 'startsAt']);
  assert.equal(toTournament({ ...row, startsAt: null, locationName: null }).location, null);
});

test('cambiare solo il fuso mantiene l\'orario locale; un campo assente non si tocca', () => {
  const current = { timezone: 'Europe/Rome', startsAt: new Date('2026-11-29T09:00:00Z') };

  const moved = toTournamentUpdate(validate(UpdateTournamentInput, { timezone: 'Europe/London' }), current);
  assert.equal(moved.timezone, 'Europe/London');
  assert.equal(moved.startsAt?.toISOString(), '2026-11-29T10:00:00.000Z');

  assert.deepEqual(toTournamentUpdate(validate(UpdateTournamentInput, { name: 'Nuovo nome' }), current), { name: 'Nuovo nome' });
  assert.deepEqual(toTournamentUpdate(validate(UpdateTournamentInput, { startsAt: null }), current), { startsAt: null });
  assert.deepEqual(
    toTournamentUpdate(validate(UpdateTournamentInput, { location: null }), current),
    { locationName: null, locationPosition: null },
  );
});
