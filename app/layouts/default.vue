<script setup lang="ts">
import { appHeader, sideMenu, sideMenuFooter } from '~/config/navigation'

const route = useRoute()

// Titolo dell'header: definito dalla pagina con definePageMeta({ title }).
const title = computed(() => (route.meta.title as string | undefined) ?? appHeader.title)
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
          <UIcon
            :name="appHeader.icon"
            class="size-5 shrink-0" />
          <span v-if="!collapsed">{{ appHeader.title }}</span>
        </NuxtLink>
        <UDashboardSidebarCollapse class="ms-auto" />
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
