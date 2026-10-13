import assert from 'node:assert/strict';
import { test } from 'node:test';

// Segnaposto finché `server/engine/` è vuoto: dimostra solo che `npm run test:engine` raccoglie i
// file di questa cartella. F1.1 lo sostituisce con il primo test vero del motore.
test('il runner dei test del motore gira', () => {
  assert.ok(true);
});
