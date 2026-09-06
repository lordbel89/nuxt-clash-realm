<script setup lang="ts">
import { CalendarDate, getLocalTimeZone } from '@internationalized/date';

const model = defineModel<Date | undefined>();

defineProps<{ disabled?: boolean; }>();

const inputDate = useTemplateRef('inputDate');
const open = ref(false);

// ponytail: il form lavora con Date, UInputDate/UCalendar con CalendarDate.
// Conversione qui dentro, così il resto dell'app non conosce @internationalized/date.
const value = computed({
  get: () => model.value
    ? new CalendarDate(model.value.getFullYear(), model.value.getMonth() + 1, model.value.getDate())
    : null,
  set: (v: CalendarDate | null) => {
    model.value = v ? v.toDate(getLocalTimeZone()) : undefined;
    open.value = false;
  },
});
</script>

<template>
  <UInputDate
    ref="inputDate"
    v-model="value"
    :disabled="disabled">
    <template #trailing>
      <UPopover
        v-model:open="open"
        :reference="inputDate?.inputsRef[3]?.$el">
        <UButton
          color="neutral"
          variant="link"
          size="sm"
          icon="i-lucide-calendar"
          :disabled="disabled"
          aria-label="Seleziona una data"
          class="px-0"
        />

        <template #content>
          <UCalendar
            v-model="value"
            class="p-2" />
        </template>
      </UPopover>
    </template>
  </UInputDate>
</template>
