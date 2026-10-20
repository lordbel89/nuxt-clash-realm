<script setup lang="ts">
import type { TournamentFormData, TournamentFormState } from '~/utils/tournamentForm';

definePageMeta({ title: 'Configurazione torneo' });

const route = useRoute();
const id = route.params.id as string;

const { data: tournament, error } = await useFetch(`/api/tournaments/${id}`);
if (error.value) {
  throw createError({ statusCode: error.value.statusCode, message: apiErrorMessage(error.value), fatal: true });
}

const config = ref<TournamentFormState>({
  name: tournament.value?.name ?? '',
  game: tournament.value?.game ?? '',
  description: tournament.value?.description,
  timezone: tournament.value?.timezone,
  // Il form vuole l'orario locale nel fuso del torneo, non l'istante in UTC
  startsAt: tournament.value?.startsAtLocal,
  maxParticipants: tournament.value?.maxParticipants,
  location: tournament.value?.location,
});

const loading = ref(false);
const errorMessage = ref<string | null>(null);

async function onSubmit(payload: TournamentFormData) {
  loading.value = true;
  errorMessage.value = null;
  try {
    await $fetch(`/api/tournaments/${id}`, { method: 'PATCH', body: payload });
    await navigateTo(`/tournaments/${id}`);
  }
  catch (error) {
    errorMessage.value = apiErrorMessage(error) ?? 'Salvataggio non riuscito';
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="max-w-xl space-y-6">
    <div class="flex justify-end gap-2">
      <UButton
        :to="`/tournaments/${id}/widgets`"
        variant="ghost">
        Widget
      </UButton>
      <UButton
        :to="`/tournaments/${id}`"
        variant="ghost">
        Torna al torneo
      </UButton>
    </div>

    <UCard>
      <TournamentForm
        v-model="config"
        submit-label="Salva configurazione"
        :loading="loading"
        @submit="onSubmit">
        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          :description="errorMessage" />
      </TournamentForm>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">
          Partecipanti
        </h2>
      </template>
      <p class="text-muted">
        Nessun partecipante.
      </p>
    </UCard>
  </div>
</template>
