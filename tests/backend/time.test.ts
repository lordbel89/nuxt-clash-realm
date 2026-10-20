import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addLocalDays,
  atLocalTime,
  canonicalTimeZone,
  deadlineAfterDays,
  endOfLocalDay,
  fromLocal,
  inTimeZone,
  isTimeZone,
  toDate,
} from '../../server/utils/time.ts';

// Le due notti del cambio d'ora a Roma nel 2026:
// 29 marzo, alle 02:00 si passa alle 03:00 (il giorno dura 23 ore);
// 25 ottobre, alle 03:00 si torna alle 02:00 (il giorno dura 25 ore).
const ROME = 'Europe/Rome';
const hoursBetween = (a: Temporal.ZonedDateTime, b: Temporal.ZonedDateTime) =>
  a.until(b, { largestUnit: 'hours' }).hours;

test('un fuso valido è un nome IANA; il nome si normalizza, gli offset fissi no', () => {
  assert.equal(canonicalTimeZone('Europe/Rome'), 'Europe/Rome');
  assert.equal(canonicalTimeZone('europe/rome'), 'Europe/Rome');
  assert.equal(canonicalTimeZone('UTC'), 'UTC');
  assert.equal(canonicalTimeZone('Europe/Roma'), null);
  assert.equal(canonicalTimeZone('+01:00'), null);
  assert.equal(canonicalTimeZone(''), null);
  assert.equal(isTimeZone('America/Santiago'), true);
});

test('da e verso il database: lo stesso istante, visto nel fuso del torneo', () => {
  const stored = new Date('2026-11-29T09:00:00Z');
  const zoned = inTimeZone(stored, ROME);

  assert.equal(zoned.toString(), '2026-11-29T10:00:00+01:00[Europe/Rome]');
  assert.equal(toDate(zoned).getTime(), stored.getTime());
});

test('un orario locale che non esiste va avanti, uno doppio prende la prima occorrenza', () => {
  assert.equal(fromLocal('2026-03-29T02:30', ROME).toString(), '2026-03-29T03:30:00+02:00[Europe/Rome]');
  assert.equal(fromLocal('2026-10-25T02:30', ROME).toString(), '2026-10-25T02:30:00+02:00[Europe/Rome]');
  assert.equal(atLocalTime('2026-11-23', '10:00', ROME).toString(), '2026-11-23T10:00:00+01:00[Europe/Rome]');
});

test('«domani alla stessa ora» dura 23 ore a marzo e 25 a ottobre', () => {
  const spring = fromLocal('2026-03-28T20:00', ROME);
  const springNext = addLocalDays(spring, 1, ROME);
  assert.equal(springNext.toString(), '2026-03-29T20:00:00+02:00[Europe/Rome]');
  assert.equal(hoursBetween(spring, springNext), 23);

  const autumn = fromLocal('2026-10-24T20:00', ROME);
  const autumnNext = addLocalDays(toDate(autumn), 1, ROME);
  assert.equal(autumnNext.toString(), '2026-10-25T20:00:00+01:00[Europe/Rome]');
  assert.equal(hoursBetween(autumn, autumnNext), 25);
});

test('«ogni venerdì alle 20» resta alle 20 dopo il cambio d\'ora', () => {
  const friday = fromLocal('2026-10-23T20:00', ROME);
  const nextFriday = addLocalDays(friday, 7, ROME);

  assert.equal(nextFriday.toString(), '2026-10-30T20:00:00+01:00[Europe/Rome]');
  assert.equal(hoursBetween(friday, nextFriday), 7 * 24 + 1);

  // Lo stesso calcolo all'indietro: «6 giorni prima, alle 10»
  const opening = atLocalTime(addLocalDays(nextFriday, -6, ROME).toPlainDate(), '10:00', ROME);
  assert.equal(opening.toString(), '2026-10-24T10:00:00+02:00[Europe/Rome]');
});

test('la fine giornata è l\'inizio del giorno dopo, anche nei giorni da 23 e 25 ore', () => {
  assert.equal(endOfLocalDay(fromLocal('2026-03-29T10:00', ROME), ROME).toString(), '2026-03-30T00:00:00+02:00[Europe/Rome]');
  assert.equal(endOfLocalDay(fromLocal('2026-10-25T10:00', ROME), ROME).toString(), '2026-10-26T00:00:00+01:00[Europe/Rome]');

  // Le 23:30 UTC del 28 marzo sono già il 29 a Roma: conta il giorno locale, non quello UTC
  assert.equal(endOfLocalDay(new Date('2026-03-28T23:30:00Z'), ROME).toString(), '2026-03-30T00:00:00+02:00[Europe/Rome]');
});

test('dove la mezzanotte salta, il giorno dopo comincia all\'01:00', () => {
  // A Santiago del Cile, il 6 settembre 2026 si passa dalle 00:00 alle 01:00
  const santiago = 'America/Santiago';
  assert.equal(endOfLocalDay(fromLocal('2026-09-05T18:00', santiago), santiago).toString(), '2026-09-06T01:00:00-03:00[America/Santiago]');
});

test('«entro 7 giorni» vale fino a fine giornata del settimo giorno, nel fuso del torneo', () => {
  // Torneo chiuso martedì 20 ottobre alle 23:30: si pubblica entro martedì 27 compreso
  const closed = fromLocal('2026-10-20T23:30', ROME);
  const deadline = deadlineAfterDays(closed, 7, ROME);

  assert.equal(deadline.toString(), '2026-10-28T00:00:00+01:00[Europe/Rome]');
  assert.ok(Temporal.ZonedDateTime.compare(fromLocal('2026-10-27T23:59', ROME), deadline) < 0);
  assert.ok(Temporal.ZonedDateTime.compare(fromLocal('2026-10-28T00:00', ROME), deadline) >= 0);
});
