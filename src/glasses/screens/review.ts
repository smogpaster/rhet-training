import { mmss } from '../../data/format'
import { MARKER_LABEL, type Session } from '../../data/model'
import { findSession } from '../../session/session'
import type { GlassesInput } from '../input'
import type { PageSpec } from '../page'
import type { Nav, Screen } from '../nav'
import { DIM, MENU, MENU_EXIT, MENU_HOME } from './common'

const BODY = { id: 1, name: 'review' }
const MAX_LINES = 8
const MAX_CHARS = 420

/** Bricht die Marker einer Session in Brillen-Seiten um (Zeilen- und Zeichenlimit). */
export function reviewPages(session: Session, participantName: string): string[] {
  const header = `${participantName} · ${mmss(session.durationSec)} · ${session.markers.length} Marker`
  const blocks: string[][] = session.markers.map(m => {
    const lines = [`${mmss(m.t)}  ${MARKER_LABEL[m.kind]}`]
    if (m.excerpt) lines.push(`  „${m.excerpt}“`)
    return lines
  })
  if (blocks.length === 0) blocks.push(['Keine Marker gesetzt.'])
  const pages: string[] = []
  let cur: string[] = [header]
  for (const block of blocks) {
    const candidate = [...cur, ...block]
    if (cur.length > 1 && (candidate.length > MAX_LINES || candidate.join('\n').length > MAX_CHARS)) {
      pages.push(cur.join('\n'))
      cur = [header, ...block]
    } else cur = candidate
  }
  pages.push(cur.join('\n'))
  return pages
}

/** Rückblick nach der Session: durchblätterbare Kurzfassung der Marker. */
export class ReviewScreen implements Screen {
  private pageIndex = 0

  constructor(private nav: Nav, private sessionId: string) {}

  private pages(): string[] {
    const ws = this.nav.store.activeWorkshop()
    const s = findSession(ws, this.sessionId)
    if (!ws || !s) return ['Session nicht gefunden']
    const name = ws.participants.find(p => p.id === s.participantId)?.name ?? 'Unbekannt'
    return reviewPages(s, name)
  }

  private body(): string {
    const pages = this.pages()
    this.pageIndex = Math.min(this.pageIndex, pages.length - 1)
    const suffix = pages.length > 1 ? `\n(${this.pageIndex + 1}/${pages.length})` : ''
    return pages[this.pageIndex] + suffix
  }

  page(): PageSpec {
    return {
      texts: [
        { ...BODY, content: this.body(), x: 0, y: 0, w: 576, h: 240, capture: true },
        { id: 2, name: 'hint', content: '▲▼ blättern   ●● zur Startseite   (Details auf dem iPhone)', x: 0, y: 248, w: 576, h: 40, textColor: DIM, padding: 6 },
      ],
      menu: [MENU_HOME, MENU_EXIT],
    }
  }

  private move(delta: number) {
    const n = this.pages().length
    this.pageIndex = (this.pageIndex + delta + n) % n
    this.nav.updateText(BODY.id, BODY.name, this.body())
  }

  private home() {
    // Rückblick ersetzt die Session-Seite; darunter liegen Detail + Liste + Start.
    while (this.nav.depth() > 1) this.nav.pop()
  }

  onInput(input: GlassesInput) {
    switch (input.kind) {
      case 'up':
        return this.move(-1)
      case 'down':
        return this.move(1)
      case 'double':
        return this.home()
      case 'menu':
        if (input.itemId === MENU.EXIT) return this.nav.exitApp()
        if (input.itemId === MENU.HOME) return this.home()
        return
      default:
        return
    }
  }
}
