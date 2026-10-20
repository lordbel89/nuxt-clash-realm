<script setup lang="ts">
import type { Organization } from '#shared/types/organization';
import type { TournamentSummary } from '#shared/types/tournament';
import type { UserSummary } from '#shared/types/user';
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui';
import { MAX_LIMIT } from '#shared/schemas/common';
import { CreateOrganizationInput, UpdateOrganizationInput } from '#shared/schemas/organization';

definePageMeta({ title: 'Tabelle' });

// ponytail: solo la prima pagina (MAX_LIMIT righe) e ricerca sulle righe caricate;
// UPagination e `search` lato server quando un elenco non sta più in una pagina.
const query = { limit: MAX_LIMIT };
const [tournaments, organizations, users] = await Promise.all([
  useFetch('/api/tournaments', { query }),
  useFetch('/api/organizations', { query }),
  useFetch('/api/users', { query }),
]);

const tables = { tournaments, organizations, users };
type TableKey = keyof typeof tables;

const tableItems: { label: string; value: TableKey; }[] = [
  { label: 'Tornei', value: 'tournaments' },
  { label: 'Organizzazioni', value: 'organizations' },
  { label: 'Utenti', value: 'users' },
];
const selected = ref<TableKey>('tournaments');

const loadError = computed(() => {
  const error = tables[selected.value].error.value;
  return error && (apiErrorMessage(error) ?? 'Lettura non riuscita');
});

const tournamentColumns: TableColumn<TournamentSummary>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Nome' },
  { accessorKey: 'game', header: 'Gioco' },
  { accessorKey: 'status', header: 'Stato' },
  { accessorKey: 'organization.name', header: 'Organizzazione' },
  { accessorKey: 'startsAt', header: 'Inizio (UTC)' },
  { id: 'actions', header: '' },
];

const organizationColumns: TableColumn<Organization>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Nome' },
  { accessorKey: 'slug', header: 'Slug' },
  { accessorKey: 'myRole', header: 'Mio ruolo' },
  { accessorKey: 'createdAt', header: 'Creata il' },
  { id: 'actions', header: '' },
];

const userColumns: TableColumn<UserSummary>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Nome' },
];

const search = ref('');

function filtered<T>(items: T[] = []) {
  const q = search.value.trim().toLowerCase();
  return q ? items.filter(item => JSON.stringify(item).toLowerCase().includes(q)) : items;
}

watch(selected, () => {
  search.value = '';
});

// Tornei e utenti non si scrivono da qui: i tornei hanno le loro pagine (un solo form),
// gli account nascono da `npm run user:create`. Nessuna delle tre entità ha un DELETE.
const open = ref(false);
const editing = ref<Organization | null>(null);
const state = ref({ name: '' });
const saving = ref(false);
const saveError = ref<string | null>(null);

function onEdit(organization: Organization | null = null) {
  editing.value = organization;
  state.value = { name: organization?.name ?? '' };
  saveError.value = null;
  open.value = true;
}

async function onSave(event: FormSubmitEvent<CreateOrganizationInput>) {
  saving.value = true;
  saveError.value = null;
  try {
    await (editing.value
      ? $fetch(`/api/organizations/${editing.value.id}`, { method: 'PATCH', body: event.data })
      : $fetch('/api/organizations', { method: 'POST', body: event.data }));
    await organizations.refresh();
    open.value = false;
  }
  catch (error) {
    saveError.value = apiErrorMessage(error) ?? 'Salvataggio non riuscito';
  }
  finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center gap-3">
      <USelect
        v-model="selected"
        :items="tableItems"
        value-key="value"
        class="w-64"
      />
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Cerca..."
        class="w-64"
      />
      <UButton
        v-if="selected === 'tournaments'"
        class="ms-auto"
        icon="i-lucide-plus"
        to="/tournaments/new">
        Nuovo torneo
      </UButton>
      <UButton
        v-else-if="selected === 'organizations'"
        class="ms-auto"
        icon="i-lucide-plus"
        @click="onEdit()">
        Nuova organizzazione
      </UButton>
    </div>

    <UAlert
      v-if="loadError"
      color="error"
      variant="subtle"
      :description="loadError"
    />

    <UTable
      v-if="selected === 'tournaments'"
      :data="filtered(tournaments.data.value?.items)"
      :columns="tournamentColumns"
      empty="Nessun torneo.">
      <template #actions-cell="{ row }">
        <div class="flex justify-end">
          <UButton
            :to="`/tournaments/${row.original.id}/settings`"
            icon="i-lucide-pencil"
            variant="ghost"
            color="neutral"
          />
        </div>
      </template>
    </UTable>

    <UTable
      v-else-if="selected === 'organizations'"
      :data="filtered(organizations.data.value?.items)"
      :columns="organizationColumns"
      empty="Nessuna organizzazione.">
      <template #actions-cell="{ row }">
        <div class="flex justify-end">
          <UButton
            icon="i-lucide-pencil"
            variant="ghost"
            color="neutral"
            @click="onEdit(row.original)"
          />
        </div>
      </template>
    </UTable>

    <UTable
      v-else
      :data="filtered(users.data.value?.items)"
      :columns="userColumns"
      empty="Nessun utente."
    />

    <UModal
      v-model:open="open"
      :title="editing ? `Modifica ${editing.name}` : 'Nuova organizzazione'">
      <template #body>
        <UForm
          :schema="editing ? UpdateOrganizationInput : CreateOrganizationInput"
          :state="state"
          class="space-y-4"
          @submit="onSave">
          <UFormField
            label="Nome"
            name="name"
            required>
            <UInput
              v-model="state.name"
              class="w-full" />
          </UFormField>

          <UAlert
            v-if="saveError"
            color="error"
            variant="subtle"
            :description="saveError"
          />

          <div class="flex justify-end gap-2">
            <UButton
              variant="ghost"
              color="neutral"
              @click="open = false">
              Annulla
            </UButton>
            <UButton
              type="submit"
              :loading="saving">
              Salva
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
