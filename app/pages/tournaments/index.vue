<script setup lang="ts">
import type { Tournament } from '~/types/tournament'

definePageMeta({ title: 'Tornei' })

// ponytail: dati dal backend (collega). Sostituire con useFetch<Tournament[]>('/api/tournaments').
const tournaments = ref<Tournament[]>([])
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-end">
      <UButton to="/tournaments/new">
        Nuovo torneo
      </UButton>
    </div>

    <div
      v-if="tournaments.length"
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
