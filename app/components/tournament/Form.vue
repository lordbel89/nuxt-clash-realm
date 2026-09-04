<script setup lang="ts">
import type { TournamentConfig, TournamentFormat } from '~/types/tournament'

const model = defineModel<TournamentConfig>({ required: true })

const emit = defineEmits<{ submit: [TournamentConfig] }>()

defineProps<{ submitLabel?: string, loading?: boolean }>()

const formats: { label: string, value: TournamentFormat }[] = [
  { label: 'Eliminazione diretta', value: 'single-elimination' },
  { label: 'Doppia eliminazione', value: 'double-elimination' },
  { label: 'Girone all\'italiana', value: 'round-robin' },
  { label: 'Svizzero', value: 'swiss' }
]

// ponytail: nessuno schema di validazione finché i campi non sono definitivi.
// Aggiungere uno schema zod su `:schema` di UForm quando il modello dati è stabile.
</script>

<template>
  <UForm
    :state="model"
    class="space-y-4"
    @submit="emit('submit', model)">
    <UFormField
      label="Nome torneo"
      name="name"
      required>
      <UInput
        v-model="model.name"
        class="w-full" />
    </UFormField>

    <UFormField
      label="Gioco"
      name="game"
      required>
      <UInput
        v-model="model.game"
        class="w-full" />
    </UFormField>

    <UFormField
      label="Formato"
      name="format"
      required>
      <USelect
        v-model="model.format"
        :items="formats"
        class="w-full" />
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        label="Durata round (minuti)"
        name="roundDurationMinutes">
        <UInput
          v-model.number="model.roundDurationMinutes"
          type="number"
          min="1"
          class="w-full" />
      </UFormField>

      <UFormField
        label="Partecipanti max"
        name="maxParticipants">
        <UInput
          v-model.number="model.maxParticipants"
          type="number"
          min="2"
          class="w-full" />
      </UFormField>
    </div>

    <slot />

    <UButton
      type="submit"
      :loading="loading">
      {{ submitLabel ?? 'Salva' }}
    </UButton>
  </UForm>
</template>
