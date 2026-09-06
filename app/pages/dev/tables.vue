<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({ title: 'Tabelle' })

type FieldType = 'text' | 'number' | 'boolean' | 'date'
interface Field { key: string; label: string; type: FieldType; }
type Row = Record<string, unknown> & { id: string; }

// ponytail: schema e righe finti, in memoria. Sostituire con le API del collega
// (GET /api/dev/tables per l'elenco+schema, CRUD su /api/dev/tables/:table[/:id]).
const tables: Record<string, { label: string; fields: Field[]; rows: Row[]; }> = reactive({
  tournaments: {
    label: 'Tornei',
    fields: [
      { key: 'name', label: 'Nome', type: 'text' },
      { key: 'game', label: 'Gioco', type: 'text' },
      { key: 'maxParticipants', label: 'Max partecipanti', type: 'number' },
      { key: 'published', label: 'Pubblicato', type: 'boolean' },
    ],
    rows: [],
  },
  participants: {
    label: 'Partecipanti',
    fields: [
      { key: 'name', label: 'Nome', type: 'text' },
      { key: 'seed', label: 'Seed', type: 'number' },
      { key: 'joinedAt', label: 'Iscritto il', type: 'date' },
    ],
    rows: [],
  },
})

const tableItems = Object.entries(tables).map(([value, t]) => ({ label: t.label, value }))
const selected = ref<string>(tableItems[0]!.value)
const table = computed(() => tables[selected.value]!)

const columns = computed<TableColumn<Row>[]>(() => [
  { accessorKey: 'id', header: 'ID' },
  ...table.value.fields.map(f => ({ accessorKey: f.key, header: f.label })),
  { id: 'actions', header: '' },
])

const search = ref('')
const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return table.value.rows
  return table.value.rows.filter(r => JSON.stringify(r).toLowerCase().includes(q))
})

const open = ref(false)
const editing = ref<Row | null>(null)
const draft = ref<Record<string, unknown>>({})

function emptyDraft() {
  return Object.fromEntries(table.value.fields.map(f => [f.key, f.type === 'boolean' ? false : '']))
}

function onCreate() {
  editing.value = null
  draft.value = emptyDraft()
  open.value = true
}

function onEdit(row: Row) {
  editing.value = row
  draft.value = { ...row }
  open.value = true
}

function onSave() {
  if (editing.value) {
    Object.assign(editing.value, draft.value)
  }
  else {
    table.value.rows.push({ ...draft.value, id: crypto.randomUUID().slice(0, 8) } as Row)
  }
  open.value = false
}

function onDelete(row: Row) {
  // ponytail: niente conferma finché è una pagina di dev
  table.value.rows = table.value.rows.filter(r => r.id !== row.id)
}

const inputTypes: Record<FieldType, string> = { text: 'text', number: 'number', boolean: 'text', date: 'date' }

watch(selected, () => {
  search.value = ''
})
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
        class="ms-auto"
        icon="i-lucide-plus"
        @click="onCreate">
        Nuovo record
      </UButton>
    </div>

    <UTable
      :data="rows"
      :columns="columns"
      :empty="`Nessun record in ${table.label}.`">
      <template #actions-cell="{ row }">
        <div class="flex justify-end gap-1">
          <UButton
            icon="i-lucide-pencil"
            variant="ghost"
            color="neutral"
            @click="onEdit(row.original)"
          />
          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            @click="onDelete(row.original)"
          />
        </div>
      </template>
    </UTable>

    <UModal
      v-model:open="open"
      :title="editing ? `Modifica record ${editing.id}` : 'Nuovo record'">
      <template #body>
        <div class="space-y-4">
          <UFormField
            v-for="field in table.fields"
            :key="field.key"
            :label="field.label">
            <USwitch
              v-if="field.type === 'boolean'"
              :model-value="!!draft[field.key]"
              @update:model-value="draft[field.key] = $event"
            />
            <UInput
              v-else
              :model-value="draft[field.key] as string"
              :type="inputTypes[field.type]"
              class="w-full"
              @update:model-value="draft[field.key] = $event"
            />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            variant="ghost"
            color="neutral"
            @click="open = false">
            Annulla
          </UButton>
          <UButton @click="onSave">
            Salva
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
