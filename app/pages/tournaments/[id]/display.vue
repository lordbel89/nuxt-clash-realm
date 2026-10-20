<script setup lang="ts">
definePageMeta({ layout: 'projector' });

const route = useRoute();
const id = route.params.id as string;

const { getLayout } = useWidgetConfig(id);
const layout = getLayout('monitor');

// ponytail: fine del round in tempo reale dal backend (collega) — polling o SSE, con F3.
const roundEndsAt = ref<string | undefined>();
</script>

<template>
  <WidgetWrapper :layout="layout">
    <template #timer>
      <div class="flex h-full items-center justify-center">
        <RoundTimer
          :ends-at="roundEndsAt"
          huge />
      </div>
    </template>
  </WidgetWrapper>
</template>
