import type { NavigationMenuItem } from '@nuxt/ui'

export interface AppHeaderConfig {
  title: string
  to: string
  /** Voci allineate a destra nella navbar */
  links: NavigationMenuItem[]
}

export const appHeader: AppHeaderConfig = {
  title: 'Clash Realm',
  to: '/',
  links: []
}

/**
 * Voci del menu laterale, raggruppate: ogni array interno è una sezione.
 * Ogni voce ha `label` e `icon`; `to` è opzionale.
 * Una voce senza `to` ma con `children` apre un sottomenu.
 */
export const sideMenu: NavigationMenuItem[][] = sideMenuDecorator([
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
  ],
  [
    {
      label: 'Community',
      icon: 'i-lucide-globe',
      defaultOpen: true,
      children: [
        {
          label: 'News feed',
          icon: 'i-lucide-megaphone'
        }
      ]
    }
  ],
  [
    {
      label: 'Admin',
      icon: 'i-lucide-shield-alert',
      defaultOpen: true,
      children: [
        {
          label: 'Utenti',
          icon: 'i-lucide-users'
        },
        {
          label: 'Permessi',
          icon: 'i-lucide-key-round'
        }
      ]
    }
  ],
  [{
    label: 'Dev',
    icon: 'i-lucide-wrench',
    defaultOpen: true,
    children: [
      { label: 'Componenti', icon: 'i-lucide-cog', to: '' },
      { label: 'Tabelle', icon: 'i-lucide-columns-3-cog', to: '/dev/tables' },
    ]
  }
  ]
]);

/** Voci ancorate in fondo alla sidebar */
export const sideMenuFooter: NavigationMenuItem[] = [
  { label: 'Esci', icon: 'i-lucide-log-out', to: '/login' }
]
