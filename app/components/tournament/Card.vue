<script setup lang="ts">
import type { Tournament } from '~/types/tournament'

defineProps<{ tournament: Tournament }>()

const statusColor = {
  draft: 'neutral',
  ready: 'secondary',
  running: 'primary',
  paused: 'warning',
  finished: 'success'
} as const
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
            {{ tournament.game }} · {{ tournament.format }}
          </p>
        </div>
        <UBadge
          :color="statusColor[tournament.status]"
          variant="subtle">
          {{ tournament.status }}
        </UBadge>
      </div>
    </template>

    <p class="text-sm text-muted">
      {{ tournament.participants.length }} partecipanti · round {{ tournament.currentRound }}
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
