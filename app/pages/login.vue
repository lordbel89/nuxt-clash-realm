<script setup lang="ts">
definePageMeta({ layout: 'auth', middleware: ['login-bypass'] });

const route = useRoute();

const state = reactive({ email: '', password: '' });
const loading = ref(false);
const errorMessage = ref<string | null>(null);

/** Solo percorsi interni: `//host` sarebbe un redirect verso l'esterno. */
function safeRedirect(value: unknown) {
  return typeof value === 'string' && /^\/(?!\/)/.test(value) ? value : '/tournaments';
}

async function onSubmit() {
  loading.value = true;
  errorMessage.value = null;

  // Better Auth non lancia: l'esito sta in `error`, con la sua forma
  // ({ code, message }), non in quella di ApiErrorData
  const { error } = await authClient.signIn.email({
    email: state.email,
    password: state.password,
  });

  loading.value = false;

  if (error) {
    errorMessage.value = error.message ?? 'Accesso non riuscito';

    return;
  }

  await navigateTo(safeRedirect(route.query.redirect));
}
</script>

<template>
  <UCard>
    <UForm
      :state="state"
      class="space-y-4"
      @submit="onSubmit">
      <UAlert
        v-if="errorMessage"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :description="errorMessage" />

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
