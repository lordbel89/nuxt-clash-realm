<script setup lang="ts">
import { appHeader, sideMenu, sideMenuFooter } from '~/config/navigation';

const route = useRoute();
const router = useRouter();

// Titolo dell'header: definito dalla pagina con definePageMeta({ title }).
const title = computed(() => (route.meta.title as string | undefined) ?? appHeader.title);

// Freccia di ritorno accanto al titolo, per le pagine con definePageMeta({ back: true }).
// Torna alla pagina da cui si è arrivati; aperta da un link diretto non c'è storia, e sale di un livello nel percorso.
function goBack() {
  if (window.history.state?.back) router.back();
  else navigateTo(route.path.replace(/\/[^/]+$/, '') || '/');
}
</script>

<template>
  <UDashboardGroup class="bg-(image:--app-gradient)">
    <UDashboardSidebar
      collapsible
      resizable
      :ui="{ footer: 'border-t border-default' }"
    >
      <template #header="{ collapsed }">
        <NuxtLink
          :to="appHeader.to"
          :class="`flex items-center justify-center gap-2 ${collapsed ? '' : 'px-6 w-full'}`">
          <DisplayLogo
            variant="mono-xl"
            :class="`mx-auto w-auto text-white ${collapsed ? 'h-6' : 'h-10'}`"
          />
          <span
            v-if="!collapsed"
            class="font-bold text-accent">{{ appHeader.title }}</span>
        </NuxtLink>

        <UDashboardSidebarCollapse class="absolute -right-4 z-50" />
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :items="sideMenu"
          :collapsed="collapsed"
          orientation="vertical"
          tooltip
          popover
        />
      </template>

      <template #footer="{ collapsed }">
        <UNavigationMenu
          :items="sideMenuFooter"
          :collapsed="collapsed"
          orientation="vertical"
          tooltip
          class="w-full"
        />
      </template>
    </UDashboardSidebar>

    <UDashboardPanel>
      <template #header>
        <UDashboardNavbar :title="title">
          <template
            v-if="route.meta.back"
            #leading>
            <UButton
              icon="i-lucide-arrow-left"
              color="neutral"
              variant="ghost"
              aria-label="Indietro"
              @click="goBack" />
          </template>
          <template #right>
            <UNavigationMenu
              v-if="appHeader.links.length"
              :items="appHeader.links" />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <slot />
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
