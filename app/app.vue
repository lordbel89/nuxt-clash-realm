<script setup>
import { it } from '@nuxt/ui/locale';
</script>

<template>
  <UApp :locale="it">
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
