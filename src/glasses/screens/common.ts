import type { MenuItemSpec } from '../page'

/** Feste IDs für Kontextmenü-Einträge (dürfen nicht 0 sein). */
export const MENU = {
  HOME: 1,
  PARTICIPANTS: 2,
  EXIT: 3,
  SESSION_END: 4,
  SESSION_PAUSE: 5,
  NEXT_PAGE: 6,
  PREV_PAGE: 7,
} as const

export const MENU_EXIT: MenuItemSpec = { id: MENU.EXIT, label: 'App beenden' }
export const MENU_HOME: MenuItemSpec = { id: MENU.HOME, label: 'Startseite' }

/** Dezente Helligkeit für Hinweise, hell für Inhalte. */
export const DIM = 1
export const NORMAL = 3
export const BRIGHT = 4
