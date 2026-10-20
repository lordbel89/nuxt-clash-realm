<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import type { TournamentFormData, TournamentFormState } from '~/utils/tournamentForm';
import { DEFAULT_TIMEZONE } from '#shared/schemas/tournament';
import { TournamentFormSchema } from '~/utils/tournamentForm';

const model = defineModel<TournamentFormState>({ required: true });

const emit = defineEmits<{ submit: [TournamentFormData]; }>();

defineProps<{ submitLabel?: string; loading?: boolean; }>();

// Per il contratto un luogo senza nome non esiste: svuotare il nome toglie il luogo
const locationName = computed({
  get: () => model.value.location?.name ?? '',
  set: (name: string) => {
    model.value.location = name ? { name, position: model.value.location?.position ?? null } : null;
  },
});

function onSubmit(event: FormSubmitEvent<TournamentFormData>) {
  emit('submit', event.data);
}
</script>

<template>
  <UForm
    :schema="TournamentFormSchema"
    :state="model"
    class="space-y-4"
    @submit="onSubmit">
    <UFormField
      label="Nome torneo"
      name="name"
      required>
      <UInput
        v-model="model.name"
        class="w-full" />
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        label="Gioco"
        name="game"
        required>
        <UInput
          v-model="model.game"
          placeholder="Magic: the Gathering"
          class="w-full" />
      </UFormField>

      <UFormField
        label="Partecipanti max"
        name="maxParticipants"
        hint="Vuoto = nessun limite">
        <UInput
          v-model.nullable="model.maxParticipants"
          type="number"
          class="w-full" />
      </UFormField>
    </div>

    <UFormField
      label="Inizio torneo"
      name="startsAt"
      :hint="model.timezone ?? DEFAULT_TIMEZONE">
      <UInput
        v-model.nullable="model.startsAt"
        type="datetime-local"
        class="w-full" />
    </UFormField>

    <UFormField
      label="Descrizione"
      name="description">
      <UInput
        v-model.nullable="model.description"
        class="w-full" />
    </UFormField>

    <div class="flex gap-4">
      <UFormField
        label="Nome location"
        name="location.name">
        <UInput
          v-model="locationName"
          class="w-full" />
      </UFormField>
      <UFormField
        label="Posizione location (TODO Maps Widget)"
        name="location.position">
        <UInput
          :model-value="model.location?.position ?? ''"
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
