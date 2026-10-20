<script setup lang="ts">
definePageMeta({ title: 'Tornei' });

const { data, status, error } = await useFetch('/api/tournaments');

const tournaments = computed(() => data.value?.items ?? []);
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-end">
      <UButton to="/tournaments/new">
        Nuovo torneo
      </UButton>
    </div>

    <p
      v-if="status === 'pending'"
      class="text-muted">
      Caricamento…
    </p>

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      title="Impossibile leggere i tornei"
      :description="error.message"
    />

    <div
      v-else-if="tournaments.length"
      class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <TournamentCard
        v-for="tournament in tournaments"
        :key="tournament.id"
        :tournament="tournament"
      />
    </div>

    <p
      v-else
      class="text-muted">
      Nessun torneo.
    </p>
  </div>
</template>
