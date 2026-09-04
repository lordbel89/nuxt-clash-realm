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
      slots: {
        base: 'rounded-xs',
      },
      defaultVariants: { size: 'md' }
    },
    card: {
      slots: { root: 'ring-default' }
    },
    navigationMenu: {
      // slots: {
      //   // linkLeadingIcon: 'bg-accent',
      //   // childLinkIcon: 'bg-primary',
      // },
      // active: {
      //   true: {
      //     childLink: 'before:bg-elevated text-highlighted',
      //     childLinkIcon: 'bg-accent'
      //   },
      //   false: {
      //     childLinkIcon: 'text-accent'
      //   }
      // },
      // compoundVariants: [
      //   {
      //     color: 'primary',
      //     variant: 'pill',
      //     active: true,
      //     class: {
      //       link: 'text-primary',
      //       linkLeadingIcon: 'text-primary group-data-[state=open]:text-accent'
      //     }
      //   },
      // ]
    }
  }
})
