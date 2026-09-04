// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devServer: { port: 3000 },
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/ui'],
  eslint: {
    config: {
      stylistic: true,
    },
  },
  ui: {
    theme: {
      colors: [
        'primary',
        'secondary',
        'accent',
        'success',
        'error',
        'warning',
        'neutral',
        'slate',
        'background',
        'white',
        'black',
        'winner',
        'loser'
      ]
    }
  },
  runtimeConfig: {
    apiSecret: '', // can be overridden by NUXT_API_SECRET environment variable
    public: {
      environment: '',
    },
  },
})