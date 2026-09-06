<script setup lang="ts">
import type { Match, Tournament } from '~/types/tournament';

definePageMeta({ layout: 'projector' });

const route = useRoute();
const _id = route.params.id as string;

// ponytail: dati in tempo reale dal backend (collega) — polling o SSE.
const tournament = ref<Tournament | null>(null);
const liveMatches = ref<Match[]>([]);
const upcomingMatches = ref<Match[]>([]);
const roundEndsAt = ref<string | undefined>();
</script>

<template>
  <div class="flex h-full flex-col gap-10">
    <header class="flex items-baseline justify-between">
      <div>
        <h1 class="text-screen font-bold">
          {{ tournament?.name ?? 'Torneo' }}
        </h1>
        <p class="text-2xl text-muted">
          Round {{ tournament?.currentRound ?? '—' }}
        </p>
      </div>
      <RoundTimer
        :ends-at="roundEndsAt"
        huge />
    </header>

    <div class="grid flex-1 gap-10 lg:grid-cols-[2fr_1fr]">
      <section class="space-y-4">
        <h2 class="text-2xl uppercase tracking-wide text-muted">
          In corso
        </h2>
        <div
          v-if="liveMatches.length"
          class="space-y-4">
          <MatchCard
            v-for="match in liveMatches"
            :key="match.id"
            :match="match"
            screen />
        </div>
        <p
          v-else
          class="text-2xl text-muted">
          Nessun match in corso.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="text-2xl uppercase tracking-wide text-muted">
          Prossimi
        </h2>
        <ul
          v-if="upcomingMatches.length"
          class="space-y-3 text-2xl">
          <li
            v-for="match in upcomingMatches"
            :key="match.id"
            class="flex justify-between gap-4">
            <span class="truncate">{{ match.home?.name ?? '—' }} vs {{ match.away?.name ?? '—' }}</span>
            <span
              v-if="match.table"
              class="text-muted">Tavolo {{ match.table }}</span>
          </li>
        </ul>
        <p
          v-else
          class="text-2xl text-muted">
          Nessun match successivo.
        </p>
      </section>
    </div>
  </div>
</template>
