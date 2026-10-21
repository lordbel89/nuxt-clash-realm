<script setup lang="ts">
import type { Organization } from '#shared/types/organization';
import type { TableColumn } from '@nuxt/ui';

definePageMeta({ title: 'Organizzazioni' });

const { query, setTotal, paginationProps, showPagination } = usePagination();
const { data, status, error, refresh } = await useFetch('/api/organizations', { query });
watch(() => data.value?.total, setTotal, { immediate: true });

const columns: TableColumn<Organization>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Nome' },
  { accessorKey: 'slug', header: 'Slug' },
  { accessorKey: 'myRole', header: 'Mio ruolo' },
  {
    accessorKey: 'createdAt',
    header: 'Creata il',
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }),
  },
  { id: 'actions', header: '' },
];

const deleting = ref<Organization | null>(null);
const deleteOpen = computed({
  get: () => deleting.value !== null,
  set: (open: boolean) => {
    if (!open) deleting.value = null;
  },
});
const deleteLoading = ref(false);
const deleteError = ref<string | null>(null);

function askDelete(organization: Organization) {
  deleteError.value = null;
  deleting.value = organization;
}

async function onDelete() {
  if (!deleting.value) return;
  deleteLoading.value = true;
  deleteError.value = null;
  try {
    // ponytail: aspetta DELETE /api/organizations/:id dal backend; finché manca risponde 405.
    // L'URL è allargato a `string` perché Nitro non tipizza un metodo senza handler: togliere il cast quando arriva.
    const url: string = `/api/organizations/${deleting.value.id}`;
    await $fetch(url, { method: 'DELETE' });
    deleting.value = null;
    await refresh();
  }
  catch (error) {
    deleteError.value = apiErrorMessage(error) ?? 'Eliminazione non riuscita';
  }
  finally {
    deleteLoading.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-end">
      <UButton
        icon="i-lucide-plus"
        to="/organizations/new">
        Nuova organizzazione
      </UButton>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="Impossibile leggere le organizzazioni"
      :description="apiErrorMessage(error) ?? error.message" />

    <UTable
      v-else
      :data="data?.items"
      :columns="columns"
      :loading="status === 'pending'"
      empty="Nessuna organizzazione.">
      <template #actions-cell="{ row }">
        <div class="flex justify-end gap-1">
          <UButton
            :to="`/organizations/${row.original.id}`"
            icon="i-lucide-pencil"
            variant="ghost"
            color="neutral"
            aria-label="Modifica" />
          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            aria-label="Elimina"
            @click="askDelete(row.original)" />
        </div>
      </template>
    </UTable>

    <div
      v-if="showPagination"
      class="flex justify-center">
      <UPagination v-bind="paginationProps" />
    </div>

    <UModal
      v-model:open="deleteOpen"
      title="Elimina organizzazione"
      :description="`Eliminare «${deleting?.name}»? L'operazione non si può annullare.`">
      <template
        v-if="deleteError"
        #body>
        <UAlert
          color="error"
          variant="subtle"
          :description="deleteError" />
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            @click="deleteOpen = false">
            Annulla
          </UButton>
          <UButton
            color="error"
            :loading="deleteLoading"
            @click="onDelete">
            Elimina
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
