<template>
  <div class="grid min-h-screen place-items-center bg-(image:--app-gradient) px-4">
    <div class="w-full max-w-sm space-y-6">
      <img
        src="/assets/Logo%20Placeholder.png"
        alt=""
        width="400"
        height="500"
        class="mx-auto h-60 w-auto"
      >
      <h1 class="text-center text-2xl font-bold text-primary">
        Clash Realm
      </h1>
      <slot />
    </div>
  </div>
</template>
