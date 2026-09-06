<script setup>
import * as uiLocales from '@nuxt/ui/locale';

// La locale la decide @nuxtjs/i18n; UApp la segue (stringhe dei componenti + dir)
const { locale } = useI18n();
</script>

<template>
  <UApp :locale="uiLocales[locale]">
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
