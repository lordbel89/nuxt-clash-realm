<script setup lang="ts">
import type { TournamentConfig } from '~/types/tournament'

definePageMeta({ title: 'Nuovo torneo' })

const config = ref<TournamentConfig>({
  name: '',
  game: '',
  format: 'single-elimination',
  roundDurationMinutes: 50,
  maxParticipants: 16
})

const loading = ref(false)

// ponytail: creazione lato backend (collega).
async function onSubmit(_payload: TournamentConfig) {
  loading.value = true
  try {
    await navigateTo('/tournaments')
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-xl space-y-6">
    <UCard>
      <TournamentForm
        v-model="config"
        submit-label="Crea torneo"
        :loading="loading"
        @submit="onSubmit"
      />
    </UCard>
  </div>
</template>
