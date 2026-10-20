import type { ScreenLayout, WidgetConfig, WidgetScreen } from '~/types/widgets';
import { WIDGET_GRID, widgetScreens } from '~/config/widgets';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/**
 * La configurazione dei widget di un torneo, un layout per schermo.
 * `getLayout` restituisce un ref modificabile; `isChanged` dice se differisce dall'ultimo caricamento o salvataggio.
 */
export function useWidgetConfig(tournamentId: string) {
  // ponytail: GET/PUT /api/tournaments/:id/widgets (collega), che non esiste ancora: intanto la
  // configurazione sta nel localStorage del browser, quindi solo su questo dispositivo.
  const storageKey = `widgets:${tournamentId}`;

  const config = ref<WidgetConfig>({
    monitor: { ...WIDGET_GRID, widgets: [] },
    judge: { ...WIDGET_GRID, widgets: [] },
    player: { ...WIDGET_GRID, widgets: [] },
  });
  const saved = ref(clone(config.value));

  // localStorage esiste solo nel browser: si legge dopo il mount, non durante l'SSR
  onMounted(() => {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return;
    config.value = JSON.parse(stored);
    saved.value = JSON.parse(stored);
  });

  const layouts = Object.fromEntries(widgetScreens.map(({ value }) => [value, computed({
    get: () => config.value[value],
    set: (layout) => { config.value[value] = layout; },
  })])) as Record<WidgetScreen, WritableComputedRef<ScreenLayout>>;

  const getLayout = (screen: WidgetScreen) => layouts[screen];

  const isChanged = (screen: WidgetScreen) =>
    JSON.stringify(config.value[screen]) !== JSON.stringify(saved.value[screen]);

  /** Salva solo lo schermo indicato: le modifiche agli altri restano in sospeso. */
  async function save(screen: WidgetScreen) {
    const next = { ...saved.value, [screen]: clone(config.value[screen]) };
    localStorage.setItem(storageKey, JSON.stringify(next));
    saved.value = next;
  }

  return { getLayout, isChanged, save };
}
