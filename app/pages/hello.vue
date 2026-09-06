<script setup lang="ts">
import type { User } from '#shared/types/user';
import type { CreateUserInput } from '#shared/schemas/user';
import { CreateUserInput as CreateUserSchema } from '#shared/schemas/user';

definePageMeta({ title: 'Hello' });

// Pagina di verifica: prima connessione reale tra frontend e database
const { data: users, status, error, refresh } = await useFetch<User[]>('/api/users');

const toast = useToast();
const inviando = ref(false);
const nuovoUtente = reactive<CreateUserInput>({ name: '', email: '' });

async function creaUtente() {
  inviando.value = true;

  try {
    await $fetch('/api/users', { method: 'POST', body: nuovoUtente });
    nuovoUtente.name = '';
    nuovoUtente.email = '';
    await refresh();
    toast.add({ title: 'Utente creato', color: 'success' });
  }
  catch (e) {
    // Il messaggio arriva dal backend: 409 email duplicata, 400 dati non validi
    toast.add({ title: (e as { statusMessage?: string; }).statusMessage ?? 'Errore', color: 'error' });
  }
  finally {
    inviando.value = false;
  }
}

function formatDate(isoDate: string) {
  // Il contratto trasporta stringhe ISO: la conversione a Date spetta a noi
  return new Date(isoDate).toLocaleDateString('it-IT', { dateStyle: 'medium' });
}
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
      v-else-if="!users?.length"
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
        <div>
          <p class="text-default font-medium">
            {{ user.name }}
          </p>
          <p class="text-muted text-sm">
            {{ user.email }}
          </p>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-muted text-sm">{{ formatDate(user.createdAt) }}</span>
          <UBadge
            :color="user.isActive ? 'success' : 'neutral'"
            variant="subtle"
          >
            {{ user.isActive ? 'Attivo' : 'Disattivo' }}
          </UBadge>
        </div>
      </li>
    </ul>

    <USeparator />

    <!-- Stesso schema che valida il body lato server: una definizione sola -->
    <UForm
      :schema="CreateUserSchema"
      :state="nuovoUtente"
      class="flex items-start gap-3"
      @submit="creaUtente"
    >
      <UFormField
        name="name"
        label="Nome">
        <UInput
          v-model="nuovoUtente.name"
          placeholder="Anna Conti" />
      </UFormField>

      <UFormField
        name="email"
        label="Email">
        <UInput
          v-model="nuovoUtente.email"
          placeholder="anna.conti@example.com" />
      </UFormField>

      <UButton
        type="submit"
        class="mt-6"
        :loading="inviando"
      >
        Aggiungi
      </UButton>
    </UForm>
  </div>
</template>
