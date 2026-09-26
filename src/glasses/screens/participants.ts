import type { GlassesInput } from '../input'
import { LIST_MAX_ITEMS, type PageSpec } from '../page'
import type { Nav, Screen } from '../nav'
import { MENU, MENU_EXIT, MENU_HOME } from './common'
import { ParticipantDetailScreen } from './participantDetail'

const PAGE_SIZE = LIST_MAX_ITEMS - 2 // Platz für "◀ zurück" und "▶ weitere"

export interface ParticipantsOptions {
  /** true: Auswahl startet direkt die Session (Meilenstein 3) */
  pickForSession?: boolean
}

/** Teilnehmerliste, bei mehr als 18 Personen mit Blättern über Listeneinträge. */
export class ParticipantsScreen implements Screen {
  private pageIndex = 0

  constructor(private nav: Nav, private options: ParticipantsOptions = {}) {}

  private names(): string[] {
    return (this.nav.store.activeWorkshop()?.participants ?? []).map(p => p.name)
  }

  private pageCount(): number {
    return Math.max(1, Math.ceil(this.names().length / PAGE_SIZE))
  }

  /** Listeneinträge der aktuellen Seite mit ihrer Bedeutung. */
  private entries(): Array<{ label: string; action: 'prev' | 'next' | 'pick' | 'none'; index?: number }> {
    const names = this.names()
    if (names.length === 0) return [{ label: 'Keine Teilnehmenden (auf dem iPhone anlegen)', action: 'none' }]
    const start = this.pageIndex * PAGE_SIZE
    const out: Array<{ label: string; action: 'prev' | 'next' | 'pick' | 'none'; index?: number }> = []
    if (this.pageIndex > 0) out.push({ label: '◀ vorherige', action: 'prev' })
    names.slice(start, start + PAGE_SIZE).forEach((n, i) => out.push({ label: n, action: 'pick', index: start + i }))
    if (this.pageIndex < this.pageCount() - 1) out.push({ label: '▶ weitere', action: 'next' })
    return out
  }

  page(): PageSpec {
    const title = this.options.pickForSession ? 'Session: wen?' : 'Teilnehmende'
    const pages = this.pageCount()
    const suffix = pages > 1 ? `  ${this.pageIndex + 1}/${pages}` : ''
    return {
      texts: [{ id: 1, name: 'title', content: title + suffix, x: 0, y: 0, w: 576, h: 40, textColor: 2, padding: 6 }],
      lists: [{ id: 2, name: 'people', items: this.entries().map(e => e.label), x: 0, y: 44, w: 576, h: 244, capture: true }],
      menu: [MENU_HOME, MENU_EXIT],
    }
  }

  onInput(input: GlassesInput) {
    if (input.kind === 'double') return this.nav.pop()
    if (input.kind === 'menu') {
      if (input.itemId === MENU.EXIT) return this.nav.exitApp()
      if (input.itemId === MENU.HOME) return this.nav.pop()
      return
    }
    if (input.kind === 'select') {
      const e = this.entries()[input.index]
      if (!e) return
      if (e.action === 'prev') {
        this.pageIndex--
        return this.nav.render()
      }
      if (e.action === 'next') {
        this.pageIndex++
        return this.nav.render()
      }
      if (e.action === 'pick' && e.index !== undefined) {
        return this.nav.push(new ParticipantDetailScreen(this.nav, e.index, this.options))
      }
    }
  }
}
