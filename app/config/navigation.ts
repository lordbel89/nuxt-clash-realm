import type { NavigationMenuItem } from '@nuxt/ui'

export interface AppHeaderConfig {
  title: string
  icon: string
  to: string
  /** Voci allineate a destra nella navbar */
  links: NavigationMenuItem[]
}

export const appHeader: AppHeaderConfig = {
  title: 'Clash Realm',
  icon: 'i-lucide-swords',
  to: '/',
  links: []
}

/**
 * Voci del menu laterale, raggruppate: ogni array interno è una sezione.
 * Ogni voce ha `label` e `icon`; `to` è opzionale.
 * Una voce senza `to` ma con `children` apre un sottomenu.
 */
export const sideMenu: NavigationMenuItem[][] = [
  [
    {
      label: 'Tornei',
      icon: 'i-lucide-trophy',
      defaultOpen: true,
      children: [
        { label: 'Elenco', icon: 'i-lucide-list', to: '/tournaments' },
        { label: 'Nuovo torneo', icon: 'i-lucide-plus', to: '/tournaments/new' }
      ]
    }
  ]
]

/** Voci ancorate in fondo alla sidebar */
export const sideMenuFooter: NavigationMenuItem[] = [
  { label: 'Esci', icon: 'i-lucide-log-out', to: '/login' }
]
