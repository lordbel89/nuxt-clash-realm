<script setup lang="ts">
import type { GridRect } from '~/utils/widgetLayout';

defineProps<{
  /** Dove sta il widget nella griglia del padre */
  placement: GridRect;
}>();
</script>

<template>
  <UCard
    class="min-h-0 min-w-0"
    :ui="{ root: 'flex flex-col', body: 'min-h-0 flex-1 overflow-auto' }"
    :style="{
      gridColumn: `${placement.col} / span ${placement.colSpan}`,
      gridRow: `${placement.row} / span ${placement.rowSpan}`,
    }">
    <slot />
  </UCard>
</template>
