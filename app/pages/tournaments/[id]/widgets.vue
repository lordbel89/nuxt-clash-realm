<script setup lang="ts">
import { widgetScreens } from '~/config/widgets';

definePageMeta({ title: 'Widget del torneo', back: true });

const route = useRoute();
const id = route.params.id as string;

const { getLayout, isChanged, save } = useWidgetConfig(id);
</script>

<template>
  <UTabs
    :items="widgetScreens"
    variant="link">
    <template #content="{ item }">
      <div class="flex justify-end px-4 pt-2">
        <UButton
          :disabled="!isChanged(item.value)"
          @click="save(item.value)">
          Salva
        </UButton>
      </div>
      <WidgetLayoutEditor
        v-model="getLayout(item.value).value"
        :frame="item.frame"
        class="pt-4" />
      <div>
        Ciaone {{ getLayout(item.value).value.widgets }}
      </div>
    </template>
  </UTabs>
</template>
