<script setup lang="ts">
import type { Standing } from '~/types/tournament'

defineProps<{ standings: Standing[] }>()

const columns = [
  { accessorKey: 'participant.name', header: 'Partecipante' },
  { accessorKey: 'played', header: 'G' },
  { accessorKey: 'wins', header: 'V' },
  { accessorKey: 'draws', header: 'P' },
  { accessorKey: 'losses', header: 'S' },
  { accessorKey: 'points', header: 'Punti' },
]
</script>

<template>
  <UTable
    :data="standings"
    :columns="columns" />
</template>
