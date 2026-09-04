// Tema grafico applicativo: alias di colore e default dei componenti Nuxt UI.
// I token grezzi (palette, font, scale) stanno in app/assets/css/main.css.
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'indigo',
      secondary: 'cyan',
      accent: 'amber',
      success: 'emerald',
      warning: 'amber',
      error: 'red',
      neutral: 'zinc',
      winner: 'winner',
      loser: 'loser'
    },
    button: {
      defaultVariants: { size: 'md' }
    },
    card: {
      slots: { root: 'ring-default' }
    }
  }
})
