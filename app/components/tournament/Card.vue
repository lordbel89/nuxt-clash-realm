<script setup lang="ts">
import type { TournamentStatus, TournamentSummary } from '#shared/types/tournament';
import type { BadgeProps } from '@nuxt/ui';

const props = defineProps<{ tournament: TournamentSummary; }>();

// `satisfies` fa fallire il typecheck quando il backend aggiunge uno stato
const statusUi = {
  draft: { label: 'Bozza', color: 'neutral' },
  published: { label: 'Pubblicato', color: 'secondary' },
  registration_open: { label: 'Iscrizioni aperte', color: 'accent' },
  checkin_open: { label: 'Check-in aperto', color: 'warning' },
  running: { label: 'In corso', color: 'primary' },
  finished: { label: 'Concluso', color: 'success' },
  cancelled: { label: 'Annullato', color: 'error' },
} as const satisfies Record<TournamentStatus, { label: string; color: BadgeProps['color']; }>;

// Data e ora nel fuso del torneo, non in quello del browser
const startsAt = computed(() => props.tournament.startsAt
  ? new Date(props.tournament.startsAt).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short', timeZone: props.tournament.timezone })
  : 'Data da fissare');
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-start justify-between gap-2">
        <div>
          <h3 class="font-semibold">
            {{ tournament.name }}
          </h3>
          <p class="text-sm text-muted">
            {{ tournament.game }} · {{ tournament.organization.name }}
          </p>
        </div>
        <UBadge
          :color="statusUi[tournament.status].color"
          variant="subtle">
          {{ statusUi[tournament.status].label }}
        </UBadge>
      </div>
    </template>

    <p class="text-sm text-muted">
      {{ startsAt }}
    </p>

    <template #footer>
      <div class="flex gap-2">
        <UButton
          :to="`/tournaments/${tournament.id}`"
          size="sm">
          Gestisci
        </UButton>
        <UButton
          :to="`/tournaments/${tournament.id}/settings`"
          size="sm"
          variant="ghost">
          Configura
        </UButton>
        <UButton
          :to="`/tournaments/${tournament.id}/display`"
          size="sm"
          variant="ghost"
          target="_blank">
          Proietta
        </UButton>
      </div>
    </template>
  </UCard>
</template>
