<script setup lang="ts">
import type { Paginated } from '#shared/types/api';
import type { Tournament } from '#shared/types/tournament';

definePageMeta({ title: 'Tornei' });

// Risponde `server/mocks/tournaments.mock.ts`: l'handler reale non esiste
// ancora. Il generico serve proprio per questo — Nitro non conosce la rotta,
// quindi non c'è niente da inferire. Quando l'endpoint arriverà va tolto,
// come in `app/pages/hello.vue`.
const { data, status, error } = await useFetch<Paginated<Tournament>>('/api/tournaments');

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
