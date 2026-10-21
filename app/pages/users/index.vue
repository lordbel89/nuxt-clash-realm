<script setup lang="ts">
import type { UserSummary } from '#shared/types/user';
import type { TableColumn } from '@nuxt/ui';

definePageMeta({ title: 'Utenti' });

// Solo lettura: l'API non crea, modifica né cancella utenti (gli account nascono da `npm run user:create`)
const { query, setTotal, paginationProps, showPagination } = usePagination();
const { data, status, error } = await useFetch('/api/users', { query });
watch(() => data.value?.total, setTotal, { immediate: true });

const columns: TableColumn<UserSummary>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Nome' },
];
</script>

<template>
  <div class="space-y-6">
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="Impossibile leggere gli utenti"
      :description="apiErrorMessage(error) ?? error.message" />

    <UTable
      v-else
      :data="data?.items"
      :columns="columns"
      :loading="status === 'pending'"
      empty="Nessun utente." />

    <div
      v-if="showPagination"
      class="flex justify-center">
      <UPagination v-bind="paginationProps" />
    </div>
  </div>
</template>
