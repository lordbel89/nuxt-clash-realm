<script setup lang="ts">
import type { TournamentConfig } from '~/types/tournament'

definePageMeta({ title: 'Configurazione torneo' })

const route = useRoute()
const id = route.params.id as string

// ponytail: caricamento e salvataggio lato backend (collega).
const config = ref<TournamentConfig>({
  name: '',
  game: '',
  format: 'single-elimination',
  roundDurationMinutes: 50,
  maxParticipants: 16,
})

const loading = ref(false)

async function onSubmit(_payload: TournamentConfig) {
  loading.value = true
  try {
    await navigateTo(`/tournaments/${id}`)
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-xl space-y-6">
    <div class="flex justify-end">
      <UButton
        :to="`/tournaments/${id}`"
        variant="ghost">
        Torna al torneo
      </UButton>
    </div>

    <UCard>
      <TournamentForm
        v-model="config"
        submit-label="Salva configurazione"
        :loading="loading"
        @submit="onSubmit"
      />
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">
          Partecipanti
        </h2>
      </template>
      <p class="text-muted">
        Nessun partecipante.
      </p>
    </UCard>
  </div>
</template>
