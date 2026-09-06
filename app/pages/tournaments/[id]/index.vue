<script setup lang="ts">
import type { Match, Standing, Tournament } from '~/types/tournament';

definePageMeta({ title: 'Torneo' });

const route = useRoute();
const id = route.params.id as string;

// ponytail: dati dal backend (collega). Sostituire con useFetch(`/api/tournaments/${id}`).
const tournament = ref<Tournament | null>(null);
const currentMatches = ref<Match[]>([]);
const standings = ref<Standing[]>([]);
const roundEndsAt = ref<string | undefined>();
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">
          {{ tournament?.name ?? 'Torneo' }}
        </h1>
        <p class="text-sm text-muted">
          Round {{ tournament?.currentRound ?? '—' }}
        </p>
      </div>

      <div class="flex items-center gap-3">
        <RoundTimer :ends-at="roundEndsAt" />
        <UButton variant="subtle">
          Avvia round
        </UButton>
        <UButton variant="ghost">
          Pausa
        </UButton>
        <UButton variant="ghost">
          Round successivo
        </UButton>
        <UButton
          :to="`/tournaments/${id}/display`"
          target="_blank"
          variant="outline">
          Proietta
        </UButton>
        <UButton
          :to="`/tournaments/${id}/settings`"
          variant="ghost">
          Configura
        </UButton>
      </div>
    </div>

    <section class="space-y-3">
      <h2 class="font-semibold">
        Match del round
      </h2>
      <div
        v-if="currentMatches.length"
        class="grid gap-4 lg:grid-cols-2">
        <MatchCard
          v-for="match in currentMatches"
          :key="match.id"
          :match="match">
          <template #footer>
            <UButton
              size="sm"
              variant="subtle">
              Registra risultato
            </UButton>
          </template>
        </MatchCard>
      </div>
      <p
        v-else
        class="text-muted">
        Nessun match nel round corrente.
      </p>
    </section>

    <section class="space-y-3">
      <h2 class="font-semibold">
        Classifica
      </h2>
      <TournamentStandings :standings="standings" />
    </section>
  </div>
</template>
