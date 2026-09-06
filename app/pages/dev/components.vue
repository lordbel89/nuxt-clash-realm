<template>
  <div>
    <UAccordion :items="slots">
      <template #datepicker="{ item }">
        <div>Data selezionata: {{ item.model }}</div>
        <FormDatePicker v-model="item.model" />
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