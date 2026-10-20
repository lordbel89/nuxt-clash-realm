/** Lo schermo che mostra un layout di widget: il TV della sala, il telefono del judge, quello del giocatore. */
export type WidgetScreen = 'monitor' | 'judge' | 'player';

export type WidgetType = 'timer' | 'tables' | 'standings' | 'judge_call' | 'organizer_messages';

/** Posizione di un widget sulla griglia dello schermo. Colonne e righe partono da 1, come in CSS grid. */
export interface WidgetPlacement {
  type: WidgetType;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

/** La griglia viaggia col layout: un layout salvato resta valido anche se la griglia di default cambia. */
export interface ScreenLayout {
  columns: number;
  rows: number;
  widgets: WidgetPlacement[];
}

export type WidgetConfig = Record<WidgetScreen, ScreenLayout>;
