// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui'],
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  ui: {
    theme: {
      // Alias di colore risolti in app/app.config.ts
      colors: [
        'primary',
        'secondary',
        'accent',
        'success',
        'error',
        'warning',
        'neutral',
        'winner',
        'loser'
      ]
    },
  },
  runtimeConfig: {
    apiSecret: '', // can be overridden by NUXT_API_SECRET environment variable
    public: {
      environment: '',
    },
  },
  devServer: { port: 3000 },
  compatibilityDate: '2025-07-15',
  eslint: {
    config: {
      stylistic: true,
    },
  },
  fonts: {
    // Lato è servito dai file in public/fonts/, non da un CDN
    families: [
      {
        name: 'Lato',
        provider: 'local',
        weights: [100, 300, 400, 700, 900],
        styles: ['normal', 'italic']
      }
    ]
  },
})
