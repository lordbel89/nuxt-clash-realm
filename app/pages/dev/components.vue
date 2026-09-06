<template>
  <div>
    <UAccordion :items="slots">
      <template #datepicker="{ item }">
        <div>Data selezionata: {{ formatDate(item.model) }}</div>
        <div class="flex gap-4 my-4">
          <FormDatePicker v-model="item.model" />
          <FormDatePicker v-model="item.model" />
        </div>
      </template>
    </UAccordion>
  </div>
</template>

<script lang="ts" setup>
definePageMeta({
  title: 'Componenti',
});

const slots = reactive([
  {
    label: 'DatePicker',
    slot: 'datepicker',
    model: new Date(),
  },
]);
</script>

<style lang="scss" scoped>

</style>