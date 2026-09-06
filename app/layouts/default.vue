<script setup lang="ts">
import { appHeader, sideMenu, sideMenuFooter } from '~/config/navigation';

const route = useRoute();

// Titolo dell'header: definito dalla pagina con definePageMeta({ title }).
const title = computed(() => (route.meta.title as string | undefined) ?? appHeader.title);
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
          class="flex items-center gap-2 font-bold text-accent">
          <img
            src="/assets/Logo%20Placeholder.png"
            alt=""
            width="400"
            height="500"
            class="mx-auto h-12 w-auto"
          >
          <span v-if="!collapsed">{{ appHeader.title }}</span>
        </NuxtLink>

        <UDashboardSidebarCollapse class="ms-auto z-50" />
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
