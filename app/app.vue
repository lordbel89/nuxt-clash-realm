<script>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { it } from '@nuxt/ui/locale'
</script>

<template>
  <UApp :locale="it">
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
