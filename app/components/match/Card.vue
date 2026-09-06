<script setup lang="ts">
import type { Match } from '~/types/tournament';

defineProps<{
  match: Match;
  /** Variante ingrandita per la pagina di proiezione */
  screen?: boolean;
}>();

const statusColor = {
  pending: 'neutral',
  running: 'primary',
  finished: 'success',
} as const;
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm text-muted">
          Round {{ match.round }}<template v-if="match.table"> · Tavolo {{ match.table }}</template>
        </span>
        <UBadge
          :color="statusColor[match.status]"
          variant="subtle"
          size="sm">
          {{ match.status }}
        </UBadge>
      </div>
    </template>

    <div
      class="grid grid-cols-[1fr_auto_1fr] items-center gap-4"
      :class="screen ? 'text-screen' : 'text-lg'"
    >
      <span class="truncate text-right">{{ match.home?.name ?? '—' }}</span>
      <span class="font-mono tabular-nums text-muted">
        {{ match.homeScore ?? '-' }} : {{ match.awayScore ?? '-' }}
      </span>
      <span class="truncate">{{ match.away?.name ?? '—' }}</span>
    </div>

    <template
      v-if="$slots.footer"
      #footer>
      <slot name="footer" />
    </template>
  </UCard>
</template>
