<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import { CreateOrganizationInput, UpdateOrganizationInput } from '#shared/schemas/organization';

definePageMeta({ title: 'Organizzazione', back: true });

// `/organizations/new` crea, `/organizations/:id` modifica
const id = useRoute().params.id as string;
const isNew = id === 'new';

const state = ref({ name: '' });

if (!isNew) {
  const { data, error } = await useFetch(`/api/organizations/${id}`);
  if (error.value) {
    throw createError({ statusCode: error.value.statusCode, message: apiErrorMessage(error.value), fatal: true });
  }
  state.value.name = data.value?.name ?? '';
}

const loading = ref(false);
const errorMessage = ref<string | null>(null);

async function onSubmit(event: FormSubmitEvent<CreateOrganizationInput>) {
  loading.value = true;
  errorMessage.value = null;
  try {
    await (isNew
      ? $fetch('/api/organizations', { method: 'POST', body: event.data })
      : $fetch(`/api/organizations/${id}`, { method: 'PATCH', body: event.data }));
    await navigateTo('/organizations');
  }
  catch (error) {
    errorMessage.value = apiErrorMessage(error) ?? 'Salvataggio non riuscito';
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <UCard class="max-w-xl">
    <template #header>
      <h2 class="font-semibold">
        {{ isNew ? 'Nuova organizzazione' : 'Modifica organizzazione' }}
      </h2>
    </template>

    <UForm
      :schema="isNew ? CreateOrganizationInput : UpdateOrganizationInput"
      :state="state"
      class="space-y-4"
      @submit="onSubmit">
      <UFormField
        label="Nome"
        name="name"
        required>
        <UInput
          v-model="state.name"
          class="w-full" />
      </UFormField>

      <UAlert
        v-if="errorMessage"
        color="error"
        variant="subtle"
        :description="errorMessage" />

      <div class="flex justify-end gap-2">
        <UButton
          to="/organizations"
          variant="ghost"
          color="neutral">
          Annulla
        </UButton>
        <UButton
          type="submit"
          :loading="loading">
          Salva
        </UButton>
      </div>
    </UForm>
  </UCard>
</template>
