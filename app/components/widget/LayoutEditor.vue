<script setup lang="ts">
import type { ScreenLayout, WidgetPlacement, WidgetType } from '~/types/widgets';
import type { GridRect } from '~/utils/widgetLayout';
import { widgetCatalog } from '~/config/widgets';

defineProps<{
  /** Classi che danno alla griglia le proporzioni dello schermo */
  frame?: string;
}>();

const layout = defineModel<ScreenLayout>({ required: true });

const grid = useTemplateRef('grid');

const available = computed(() =>
  (Object.keys(widgetCatalog) as WidgetType[]).filter(type => !layout.value.widgets.some(w => w.type === type)));
const freeCell = computed(() => firstFreeCell(layout.value));

function add(type: WidgetType) {
  if (!freeCell.value) return;
  layout.value = { ...layout.value, widgets: [...layout.value.widgets, { type, ...freeCell.value }] };
}

function remove(type: WidgetType) {
  layout.value = { ...layout.value, widgets: layout.value.widgets.filter(w => w.type !== type) };
}

/** Applica la nuova posizione solo se è valida: altrimenti il widget resta dov'era. */
function place(widget: WidgetPlacement, rect: GridRect) {
  if (!fitsInLayout(layout.value, rect, widget.type)) return;
  layout.value = {
    ...layout.value,
    widgets: layout.value.widgets.map(w => (w.type === widget.type ? { ...w, ...rect } : w)),
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function cellAt(event: PointerEvent) {
  const box = grid.value!.getBoundingClientRect();
  const { columns, rows } = layout.value;
  return {
    col: clamp(Math.floor(((event.clientX - box.left) / box.width) * columns) + 1, 1, columns),
    row: clamp(Math.floor(((event.clientY - box.top) / box.height) * rows) + 1, 1, rows),
  };
}

// Il widget in trascinamento; `grab` è la cella del widget in cui è stato preso
const drag = ref<{ type: WidgetType; mode: 'move' | 'resize'; grabCol: number; grabRow: number; } | null>(null);

function startDrag(event: PointerEvent, widget: WidgetPlacement, mode: 'move' | 'resize') {
  const cell = cellAt(event);
  drag.value = { type: widget.type, mode, grabCol: cell.col - widget.col, grabRow: cell.row - widget.row };
  // La griglia riceve i movimenti anche quando il puntatore esce dal widget
  grid.value!.setPointerCapture(event.pointerId);
}

function onDrag(event: PointerEvent) {
  const current = drag.value;
  const widget = current && layout.value.widgets.find(w => w.type === current.type);
  if (!current || !widget) return;
  const cell = cellAt(event);
  const { columns, rows } = layout.value;
  place(widget, current.mode === 'move'
    ? {
        ...widget,
        // Contro il bordo il widget scorre lungo l'altro asse invece di fermarsi
        col: clamp(cell.col - current.grabCol, 1, columns - widget.colSpan + 1),
        row: clamp(cell.row - current.grabRow, 1, rows - widget.rowSpan + 1),
      }
    : { ...widget, colSpan: Math.max(1, cell.col - widget.col + 1), rowSpan: Math.max(1, cell.row - widget.row + 1) });
}

const arrows: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Frecce spostano, Shift+frecce ridimensionano, Canc rimuove. */
function onKeydown(event: KeyboardEvent, widget: WidgetPlacement) {
  if (event.key === 'Delete' || event.key === 'Backspace') return remove(widget.type);
  const arrow = arrows[event.key];
  if (!arrow) return;
  event.preventDefault();
  const [dc, dr] = arrow;
  place(widget, event.shiftKey
    ? { ...widget, colSpan: widget.colSpan + dc, rowSpan: widget.rowSpan + dr }
    : { ...widget, col: widget.col + dc, row: widget.row + dr });
}

function describe(widget: WidgetPlacement) {
  const span = (start: number, size: number) => (size > 1 ? `${start}–${start + size - 1}` : `${start}`);
  return `${widgetCatalog[widget.type].label}: colonne ${span(widget.col, widget.colSpan)}, righe ${span(widget.row, widget.rowSpan)}`;
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <UButton
        v-for="type in available"
        :key="type"
        :icon="widgetCatalog[type].icon"
        :label="widgetCatalog[type].label"
        :disabled="!freeCell"
        size="sm"
        variant="outline"
        @click="add(type)" />
      <span
        v-if="!available.length"
        class="text-sm text-muted">
        Tutti i widget sono sullo schermo.
      </span>
    </div>

    <div
      ref="grid"
      class="grid gap-1 rounded-lg border border-default bg-elevated p-1"
      :class="frame"
      :style="{
        gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
      }"
      @pointermove="onDrag"
      @pointerup="drag = null"
      @pointercancel="drag = null">
      <div
        v-for="i in layout.columns * layout.rows"
        :key="`cell-${i}`"
        class="rounded border border-dashed border-default"
        :style="{ gridColumn: ((i - 1) % layout.columns) + 1, gridRow: Math.ceil(i / layout.columns) }" />

      <div
        v-for="widget in layout.widgets"
        :key="widget.type"
        tabindex="0"
        :aria-label="describe(widget)"
        :title="describe(widget)"
        class="relative flex min-w-0 touch-none select-none items-center justify-center rounded-md border-2 p-2 text-center text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :class="drag?.type === widget.type
          ? 'z-10 cursor-grabbing border-primary bg-primary/25'
          : 'cursor-grab border-primary/60 bg-primary/10'"
        :style="{
          gridColumn: `${widget.col} / span ${widget.colSpan}`,
          gridRow: `${widget.row} / span ${widget.rowSpan}`,
        }"
        @pointerdown="startDrag($event, widget, 'move')"
        @keydown="onKeydown($event, widget)">
        <span class="truncate">{{ widgetCatalog[widget.type].label }}</span>
        <UButton
          icon="i-lucide-x"
          size="xs"
          color="neutral"
          variant="ghost"
          aria-label="Rimuovi widget"
          class="absolute top-0.5 right-0.5"
          @pointerdown.stop
          @click="remove(widget.type)" />
        <UIcon
          name="i-lucide-move-diagonal-2"
          class="absolute right-0.5 bottom-0.5 size-4 cursor-nwse-resize text-primary"
          @pointerdown.stop="startDrag($event, widget, 'resize')" />
      </div>
    </div>

    <p class="text-xs text-muted">
      Trascina un widget per spostarlo, l'angolo in basso a destra per allargarlo.
      Da tastiera: frecce per spostare, Shift+frecce per ridimensionare, Canc per rimuovere.
    </p>
  </div>
</template>
