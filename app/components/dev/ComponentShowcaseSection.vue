<script setup lang="ts">
import type { Component } from 'vue';
import type { PropControl } from '~/types/components';

const props = defineProps<{
  component: Component;
  /** Valori di partenza delle prop, v-model compreso (`modelValue`) */
  initial?: Record<string, unknown>;
  /** Controllo forzato per singola prop, es. `{ endsAt: 'datetime' }` */
  overrides?: Record<string, PropControl>;
}>();

const values = ref<Record<string, unknown>>({ ...props.initial });

const RUNTIME_TYPES = new Map<unknown, PropControl>([
  [Boolean, 'boolean'],
  [String, 'string'],
  [Number, 'number'],
  [Date, 'date'],
]);

type RuntimeComponent = {
  props?: Record<string, { type?: unknown; } | null>;
  emits?: string[] | Record<string, unknown>;
};

// ponytail: legge le props runtime che Vue genera da defineProps. defineModel non ha tipo
// runtime (`type: null`) e va sempre in `overrides`; nella build di produzione il compilatore
// toglie anche i tipi diversi da Boolean, e quelle prop diventano "Tipo non gestito"
const controls = computed(() => {
  const defs = (props.component as RuntimeComponent).props ?? {};
  return Object.fromEntries(Object.entries(defs)
    .filter(([key]) => !key.endsWith('Modifiers'))
    .map(([key, def]) => {
      const auto = [def?.type].flat().map(t => RUNTIME_TYPES.get(t)).find(Boolean) ?? null;
      return [key, props.overrides?.[key] ?? auto];
    }));
});

// Ogni `update:x` emesso dal componente (v-model) torna nei valori della PropsCard
const listeners = computed(() => {
  const emits = (props.component as RuntimeComponent).emits ?? [];
  return Object.fromEntries((Array.isArray(emits) ? emits : Object.keys(emits))
    .filter(name => name.startsWith('update:'))
    .map((name) => {
      const prop = name.slice('update:'.length);
      return [`onUpdate:${prop}`, (value: unknown) => {
        values.value = { ...values.value, [prop]: value };
      }];
    }));
});
</script>

<template>
  <div class="grid gap-4 md:grid-cols-[20rem_1fr]">
    <DevPropsCard
      v-model="values"
      :controls="controls" />
    <div class="flex items-center justify-center rounded-lg border border-dashed border-default p-6">
      <component
        :is="component"
        v-bind="{ ...values, ...listeners }" />
    </div>
  </div>
</template>
