import assert from 'node:assert/strict';
import { test } from 'node:test';
import { collect, resolveLocked } from '../../scripts/runtime-deps.ts';

// Un lockfile in piccolo: `b` ha due versioni, una annidata sotto `a`
const packages = {
  'node_modules/a': { dependencies: { b: '^2' }, peerDependencies: { c: '*', opzionale: '*' }, peerDependenciesMeta: { opzionale: { optional: true } } },
  'node_modules/a/node_modules/b': {},
  'node_modules/b': {},
  'node_modules/c': { optionalDependencies: { 'solo-su-windows': '*' } },
  'node_modules/opzionale': {},
  'node_modules/non-richiesto': {},
};

test('la versione più vicina vince, come in Node', () => {
  assert.equal(resolveLocked(packages, 'node_modules/a', 'b'), 'node_modules/a/node_modules/b');
  assert.equal(resolveLocked(packages, 'node_modules/c', 'b'), 'node_modules/b');
  assert.equal(resolveLocked(packages, '', 'b'), 'node_modules/b');
  assert.equal(resolveLocked(packages, '', 'assente'), null);
});

test('segue dipendenze e peer necessari, salta i peer facoltativi e ciò che il lockfile non ha', () => {
  assert.deepEqual(collect(packages, ['a']), ['node_modules/a', 'node_modules/a/node_modules/b', 'node_modules/c']);
});

test('una radice assente dal lockfile è un errore, non un silenzio', () => {
  assert.throws(() => collect(packages, ['assente']), /assente non è nel lockfile/);
});
