<template>
  <div>
    <UAccordion :items="items">
      <template #body="{ item }">
        <DevComponentShowcaseSection
          :component="item.component"
          :initial="item.initial"
          :overrides="item.overrides" />
      </template>
    </UAccordion>
  </div>
</template>

<script lang="ts" setup>
import type { Component } from 'vue';
import type { PropControl } from '~/types/components';
import { FormDatePicker, RoundTimer } from '#components';

definePageMeta({
  title: 'Componenti',
});

const items: {
  label: string;
  component: Component;
  initial?: Record<string, unknown>;
  overrides?: Record<string, PropControl>;
}[] = [
  {
    label: 'DatePicker',
    component: FormDatePicker,
    initial: { modelValue: new Date() },
    overrides: { modelValue: 'date' },
  },
  {
    label: 'Round Timer',
    component: RoundTimer,
    initial: { huge: true, endsAt: '2026-10-22T00:00:00.000Z' },
    overrides: { endsAt: 'datetime' },
  },
];
items.sort((a, b) => a.label.localeCompare(b.label));
</script>
