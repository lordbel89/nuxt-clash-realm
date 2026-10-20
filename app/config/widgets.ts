import type { WidgetScreen, WidgetType } from '~/types/widgets';

/** Griglia di partenza di ogni schermo */
export const WIDGET_GRID = { columns: 6, rows: 6 };

/** `frame` dà alla griglia le proporzioni dello schermo vero */
export const widgetScreens: { value: WidgetScreen; label: string; icon: string; frame: string; }[] = [
  { value: 'monitor', label: 'Monitor', icon: 'i-lucide-tv', frame: 'aspect-video w-full' },
  { value: 'judge', label: 'Schermo judge', icon: 'i-lucide-shield-check', frame: 'aspect-[9/16] w-full max-w-xs' },
  { value: 'player', label: 'Schermo giocatore', icon: 'i-lucide-smartphone', frame: 'aspect-[9/16] w-full max-w-xs' },
];

/** I widget disponibili. Ognuno avrà il suo componente, agnostico, che riceve i dati come prop. */
export const widgetCatalog: Record<WidgetType, { label: string; icon: string; }> = {
  timer: { label: 'Cronometro', icon: 'i-lucide-timer' },
  tables: { label: 'Tavoli', icon: 'i-lucide-layout-grid' },
  standings: { label: 'Classifica', icon: 'i-lucide-list-ordered' },
  judge_call: { label: 'Chiamata arbitro', icon: 'i-lucide-hand' },
  organizer_messages: { label: 'Messaggi dell\'organizzatore', icon: 'i-lucide-megaphone' },
};
