import type { ScreenLayout, WidgetPlacement, WidgetType } from '~/types/widgets';

export type GridRect = Pick<WidgetPlacement, 'col' | 'row' | 'colSpan' | 'rowSpan'>;

/** Il rettangolo sta nella griglia e non tocca altri widget; `ignore` è quello che si sta spostando. */
export function fitsInLayout(layout: ScreenLayout, rect: GridRect, ignore?: WidgetType): boolean {
  if (rect.col < 1 || rect.row < 1 || rect.colSpan < 1 || rect.rowSpan < 1) return false;
  if (rect.col + rect.colSpan - 1 > layout.columns || rect.row + rect.rowSpan - 1 > layout.rows) return false;
  return layout.widgets.every(w => w.type === ignore
    || rect.col >= w.col + w.colSpan || w.col >= rect.col + rect.colSpan
    || rect.row >= w.row + w.rowSpan || w.row >= rect.row + rect.rowSpan);
}

/** La prima cella libera, riga per riga; null a griglia piena. */
export function firstFreeCell(layout: ScreenLayout): GridRect | null {
  for (let row = 1; row <= layout.rows; row++) {
    for (let col = 1; col <= layout.columns; col++) {
      const rect = { col, row, colSpan: 1, rowSpan: 1 };
      if (fitsInLayout(layout, rect)) return rect;
    }
  }
  return null;
}
