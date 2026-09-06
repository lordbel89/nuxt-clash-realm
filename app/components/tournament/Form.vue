<script setup lang="ts">
import type { USelectItem } from '~/types/components';
import type { TournamentConfig } from '~/types/tournament';

const model = defineModel<TournamentConfig>({ required: true });

const emit = defineEmits<{ submit: [TournamentConfig]; }>();

defineProps<{ submitLabel?: string; loading?: boolean; }>();

const games: USelectItem<string>[] = [
  { label: 'BeyBlade X', value: 'bbx' },
  { label: 'Cyberpunk TCG', value: 'cyberpunk-tcg' },
  { label: 'Altro', value: 'other' },
];

const leagues: USelectItem<string>[] = [
  { label: 'Andycards Local', value: 'andylocal' },
  { label: 'Lega del male', value: 'badleague' },
];

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
      <USelect
        v-model="model.game"
        :items="games"
        class="w-full" />
    </UFormField>

    <UFormField
      label="Lega"
      name="league">
      <div class="flex gap-2">
        <USelect
          v-model="model.leagueId"
          :items="leagues"
          class="w-full" />
        <UButton
          v-if="model.leagueId"
          variant="outline"
          icon="i-lucide-trash"
          size="sm"
          @click="model.leagueId = undefined" />
      </div>
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-4">
      <UFormField
        label="A Squadre"
        name="isTeam"
        required>
        <USwitch
          v-model="model.isTeam"
        />
      </UFormField>
      <UFormField
        label="Partecipanti max"
        name="maxParticipants"
      >
        <UInput
          v-model.number="model.maxParticipants"
          type="number"
          min="2"
          class="w-full" />
      </UFormField>
    </div>

    <UFormField
      label="Descrizione"
      name="description"
    >
      <UInput
        v-model="model.description"
        class="w-full" />
    </UFormField>
    <UFormField
      label="Inizio torneo"
      name="startDate"
    >
      <FormDatePicker
        v-model="model.startDate"
        class="w-full" />
    </UFormField>

    <div class="flex gap-4">
      <UFormField
        label="Nome location"
        name="locationName"
      >
        <UInput
          v-model="model.location.name"
          class="w-full" />
      </UFormField>
      <UFormField
        label="Posizione location (TODO Maps Widget)"
        name="locationPosition"
      >
        <UInput
          v-model="model.location.position"
          disabled
          class="w-full" />
      </UFormField>
    </div>

    <slot />
    <div class="flex justify-end">
      <UButton
        type="submit"
        :loading="loading">
        {{ submitLabel ?? 'Salva' }}
      </UButton>
    </div>
  </UForm>
</template>
