<script setup lang="ts">
import type { ScreenLayout, WidgetType } from '~/types/widgets';
import { widgetCatalog } from '~/config/widgets';

defineProps<{
  layout: ScreenLayout;
}>();

// Uno slot per tipo di widget: la pagina ci mette il componente specifico con i suoi dati
defineSlots<Partial<Record<WidgetType, () => unknown>>>();
</script>

<template>
  <div
    class="grid size-full gap-2"
    :style="{
      gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
      gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
    }">
    <WidgetCard
      v-for="widget in layout.widgets"
      :key="widget.type"
      :placement="widget">
      <slot :name="widget.type">
        <span class="text-muted">{{ widgetCatalog[widget.type].label }}</span>
      </slot>
    </WidgetCard>
  </div>
</template>
