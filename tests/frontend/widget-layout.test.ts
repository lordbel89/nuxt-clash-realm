import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ScreenLayout } from '../../app/types/widgets.ts';
import { firstFreeCell, fitsInLayout } from '../../app/utils/widgetLayout.ts';

// Il cronometro occupa le colonne 3–6 della riga 1: le colonne 1–2 restano libere
const layout: ScreenLayout = {
  columns: 6,
  rows: 6,
  widgets: [{ type: 'timer', col: 3, row: 1, colSpan: 4, rowSpan: 1 }],
};

test('un widget sta nello spazio libero accanto a un altro', () => {
  assert.equal(fitsInLayout(layout, { col: 1, row: 1, colSpan: 2, rowSpan: 1 }), true);
});

test('un widget non si sovrappone a un altro', () => {
  assert.equal(fitsInLayout(layout, { col: 2, row: 1, colSpan: 2, rowSpan: 1 }), false);
  assert.equal(fitsInLayout(layout, { col: 4, row: 1, colSpan: 1, rowSpan: 2 }), false);
});

test('il widget spostato non collide con sé stesso', () => {
  assert.equal(fitsInLayout(layout, { col: 2, row: 1, colSpan: 4, rowSpan: 1 }, 'timer'), true);
});

test('un widget non esce dalla griglia né ha dimensione nulla', () => {
  assert.equal(fitsInLayout(layout, { col: 6, row: 6, colSpan: 2, rowSpan: 1 }), false);
  assert.equal(fitsInLayout(layout, { col: 0, row: 2, colSpan: 1, rowSpan: 1 }), false);
  assert.equal(fitsInLayout(layout, { col: 1, row: 2, colSpan: 0, rowSpan: 1 }), false);
});

test('la prima cella libera salta quelle occupate; null a griglia piena', () => {
  assert.deepEqual(firstFreeCell(layout), { col: 1, row: 1, colSpan: 1, rowSpan: 1 });
  const full: ScreenLayout = { columns: 2, rows: 1, widgets: [{ type: 'tables', col: 1, row: 1, colSpan: 2, rowSpan: 1 }] };
  assert.equal(firstFreeCell(full), null);
});
