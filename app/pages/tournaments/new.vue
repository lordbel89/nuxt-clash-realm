<script setup lang="ts">
import type { TournamentFormData, TournamentFormState } from '~/utils/tournamentForm';

definePageMeta({ title: 'Nuovo torneo' });

// Un torneo nasce in un'organizzazione di chi lo crea
const { data: organizations } = await useFetch('/api/organizations');
const organizationItems = computed(() => organizations.value?.items.map(organization => ({ label: organization.name, value: organization.id })) ?? []);
const organizationId = ref(organizations.value?.items[0]?.id);

const config = ref<TournamentFormState>({ name: '', game: '' });

const loading = ref(false);
const errorMessage = ref<string | null>(null);

async function onSubmit(payload: TournamentFormData) {
  if (!organizationId.value) {
    return;
  }
  loading.value = true;
  errorMessage.value = null;
  try {
    const tournament = await $fetch('/api/tournaments', { method: 'POST', body: { ...payload, organizationId: organizationId.value } });
    await navigateTo(`/tournaments/${tournament.id}`);
  }
  catch (error) {
    errorMessage.value = apiErrorMessage(error) ?? 'Creazione non riuscita';
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="max-w-xl space-y-6">
    <UAlert
      v-if="!organizationItems.length"
      color="warning"
      variant="subtle"
      title="Nessuna organizzazione"
      description="Un torneo appartiene a un'organizzazione: serve farne parte per crearne uno." />

    <TournamentForm
      v-else
      v-model="config"
      submit-label="Crea torneo"
      :loading="loading"
      @submit="onSubmit">
      <UFormField
        label="Organizzazione"
        required>
        <USelect
          v-model="organizationId"
          :items="organizationItems"
          class="w-full" />
      </UFormField>

      <UAlert
        v-if="errorMessage"
        color="error"
        variant="subtle"
        :description="errorMessage" />
    </TournamentForm>
  </div>
</template>
