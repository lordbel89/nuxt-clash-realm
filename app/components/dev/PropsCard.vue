<script setup lang="ts">
import type { PropControl } from '~/types/components';

const model = defineModel<Record<string, unknown>>({ required: true });

/** null = tipo che la card non sa modificare: il valore resta quello iniziale */
defineProps<{ controls: Record<string, PropControl | null>; }>();

function set(key: string, value: unknown) {
  model.value = { ...model.value, [key]: value };
}

// ISO UTC <-> datetime-local; in UTC, così server e client mostrano lo stesso valore
const toInput = (iso: unknown) => typeof iso === 'string' && iso ? new Date(iso).toISOString().slice(0, 16) : '';
const fromInput = (local: string) => local ? new Date(`${local}Z`).toISOString() : undefined;
</script>

<template>
  <UCard>
    <div class="flex flex-col gap-4">
      <UFormField
        v-for="(control, key) in controls"
        :key="key"
        :label="key"
        :hint="control === 'datetime' ? 'UTC' : undefined">
        <USwitch
          v-if="control === 'boolean'"
          :model-value="!!model[key]"
          @update:model-value="set(key, $event)" />
        <UInput
          v-else-if="control === 'string'"
          :model-value="model[key] as string"
          class="w-full"
          @update:model-value="set(key, $event)" />
        <UInputNumber
          v-else-if="control === 'number'"
          :model-value="model[key] as number"
          class="w-full"
          @update:model-value="set(key, $event)" />
        <FormDatePicker
          v-else-if="control === 'date'"
          :model-value="model[key] as Date"
          @update:model-value="set(key, $event)" />
        <UInput
          v-else-if="control === 'datetime'"
          type="datetime-local"
          :model-value="toInput(model[key])"
          class="w-full"
          @update:model-value="set(key, fromInput(String($event)))" />
        <USelect
          v-else-if="Array.isArray(control)"
          :items="[...control]"
          :model-value="model[key] as string"
          class="w-full"
          @update:model-value="set(key, $event)" />
        <span
          v-else
          class="text-sm text-muted">
          Tipo non gestito
        </span>
      </UFormField>
    </div>
  </UCard>
</template>
