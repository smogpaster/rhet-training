// Eigene, schlanke Beschreibung einer Brillen-Seite. render.ts übersetzt sie in SDK-Objekte.

export const SCREEN_W = 576
export const SCREEN_H = 288

export interface TextSpec {
  id: number
  /** max. 16 Zeichen, eindeutig pro Seite */
  name: string
  content: string
  x?: number
  y?: number
  w?: number
  h?: number
  /** Helligkeit 0 (dunkel) bis 4 (hell); weglassen = Gerätestandard */
  textColor?: number
  padding?: number
  border?: number
  /** Genau ein Container pro Seite muss Eingaben fangen. */
  capture?: boolean
}

export interface ListSpec {
  id: number
  name: string
  /** max. 20 Einträge à 64 Zeichen */
  items: string[]
  x?: number
  y?: number
  w?: number
  h?: number
  capture?: boolean
}

export interface MenuItemSpec {
  /** ungleich 0, eindeutig innerhalb des Menüs */
  id: number
  /** max. 32 UTF-8-Bytes, gut lesbar unter ca. 16 Zeichen */
  label: string
}

export interface PageSpec {
  texts?: TextSpec[]
  lists?: ListSpec[]
  /** Kontextmenü (Tipp, dann lange drücken). Max. 10 Einträge. */
  menu?: MenuItemSpec[]
}

/** Kürzt Text auf `max` Zeichen (Zeichen, nicht Bytes) mit Auslassungspunkten. */
export function clip(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, Math.max(0, max - 1)) + '…'
}

/** Textcontainer-Inhalt auf das Limit der jeweiligen Operation begrenzen. */
export const TEXT_LIMIT_CREATE = 1000
export const TEXT_LIMIT_UPGRADE = 2000
export const LIST_MAX_ITEMS = 20
export const LIST_ITEM_MAX_CHARS = 64
