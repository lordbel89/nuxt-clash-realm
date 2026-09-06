<script setup lang="ts">
definePageMeta({ layout: 'auth' });

const state = reactive({ email: '', password: '' });
const loading = ref(false);

// ponytail: autenticazione lato backend (collega). Qui solo il form.
async function onSubmit() {
  loading.value = true;
  try {
    await navigateTo('/tournaments');
  }
  finally {
    loading.value = false;
  }
}
</script>

<template>
  <UCard>
    <UForm
      :state="state"
      class="space-y-4"
      @submit="onSubmit">
      <UFormField
        label="Email"
        name="email"
        required>
        <UInput
          v-model="state.email"
          type="email"
          autocomplete="email"
          class="w-full" />
      </UFormField>

      <UFormField
        label="Password"
        name="password"
        required>
        <UInput
          v-model="state.password"
          type="password"
          autocomplete="current-password"
          class="w-full" />
      </UFormField>

      <UButton
        type="submit"
        block
        :loading="loading">
        Accedi
      </UButton>
    </UForm>
  </UCard>
</template>
