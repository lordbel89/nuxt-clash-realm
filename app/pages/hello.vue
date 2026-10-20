<script setup lang="ts">
definePageMeta({ title: 'Hello' });

// Pagina di verifica: prima connessione reale tra frontend e database.
// Niente generico su useFetch: annotarlo a mano disattiva l'inferenza da Nitro,
// che è proprio ciò che tiene allineati handler e pagina. L'endpoint risponde
// con un `Paginated<UserSummary>`, quindi le righe stanno in `items`.
const { data, status, error } = await useFetch('/api/users');

const users = computed(() => data.value?.items ?? []);
</script>

<template>
  <div class="p-6 space-y-6">
    <p class="text-muted">
      Elenco letto da <code>/api/users</code>.
    </p>

    <p
      v-if="status === 'pending'"
      class="text-muted">
      Caricamento…
    </p>

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      title="Impossibile leggere gli utenti"
      :description="error.message"
    />

    <p
      v-else-if="!users.length"
      class="text-muted">
      Nessun utente. Esegui <code>npm run db:seed</code>.
    </p>

    <ul
      v-else
      class="divide-y divide-default">
      <li
        v-for="user in users"
        :key="user.id"
        class="flex items-center justify-between gap-4 py-3"
      >
        <p class="text-default font-medium">
          {{ user.name }}
        </p>
        <span class="text-muted text-sm">{{ user.id }}</span>
      </li>
    </ul>
  </div>
</template>
