<script setup lang="ts">
const props = defineProps<{
  /** ISO date di fine round */
  endsAt?: string;
  huge?: boolean;
}>()

// null finché non montato: evita mismatch di idratazione fra server e client
const now = ref<number | null>(null)
let handle: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  now.value = Date.now()
  handle = setInterval(() => (now.value = Date.now()), 1000)
})
onUnmounted(() => clearInterval(handle))

const remaining = computed(() => {
  if (now.value === null || !props.endsAt) return null
  return Math.max(0, Math.floor((new Date(props.endsAt).getTime() - now.value) / 1000))
})

const label = computed(() => {
  if (remaining.value === null) return '--:--'
  const m = Math.floor(remaining.value / 60)
  const s = remaining.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const expired = computed(() => remaining.value === 0)
</script>

<template>
  <span
    class="font-mono tabular-nums"
    :class="[
      huge ? 'text-screen-lg font-bold' : 'text-2xl font-semibold',
      expired ? 'text-error' : 'text-default',
    ]"
  >
    {{ label }}
  </span>
</template>
