import assert from 'node:assert/strict';
import { test } from 'node:test';

// Il backend conta su Temporal nativo (Node 26). Alcune build di Node 26, come quella di Homebrew,
// sono compilate senza: questo test lo dice subito, invece di un ReferenceError a metà di un servizio.
test('Temporal è nativo nel runtime', () => {
  assert.equal(typeof Temporal, 'object', 'Temporal non è definito: serve la build ufficiale di Node 26 (vedi .nvmrc)');
});

test('Temporal conosce il fuso di Roma e le due notti del cambio d\'ora', () => {
  // 29/3/2026: alle 02:00 si passa alle 03:00, quindi le 02:30 non esistono
  const spring = Temporal.ZonedDateTime.from('2026-03-29T02:30[Europe/Rome]', { disambiguation: 'compatible' });
  assert.equal(spring.toString(), '2026-03-29T03:30:00+02:00[Europe/Rome]');

  // 25/10/2026: le 02:30 capitano due volte, `compatible` prende la prima (ancora in ora legale)
  const autumn = Temporal.ZonedDateTime.from('2026-10-25T02:30[Europe/Rome]', { disambiguation: 'compatible' });
  assert.equal(autumn.toString(), '2026-10-25T02:30:00+02:00[Europe/Rome]');
  assert.equal(autumn.add({ hours: 1 }).toString(), '2026-10-25T02:30:00+01:00[Europe/Rome]');
});
