import { mmss } from '../../data/format'
import { MARKER_LABEL, type MarkerKind, type Session } from '../../data/model'
import { addMarker, elapsedSec, endSession, findSession, removeMarker, togglePause } from '../../session/session'
import type { GlassesInput } from '../input'
import type { PageSpec } from '../page'
import type { Nav, Screen } from '../nav'
import { DIM, MENU, MENU_EXIT } from './common'
import { ReviewScreen } from './review'

const TIME = { id: 1, name: 'time' }
const CONFIRM = { id: 2, name: 'confirm' }
const CONFIRM_MS = 3000
/** Kommt ein Doppeltipp so kurz nach einem Einfachtipp, war es einer: Marker umwandeln. */
const DOUBLE_GRACE_MS = 450

/**
 * Laufende Session: nur Redezeit und eine dezente Bestätigung.
 * Einfachtipp = "stark", Doppeltipp = "besprechen", Kontextmenü = Pause / Beenden.
 */
export class SessionScreen implements Screen {
  selfUpdating = true
  private ticker: ReturnType<typeof setInterval> | null = null
  private confirmTimer: ReturnType<typeof setTimeout> | null = null
  private confirmText = ''
  private lastTap: { markerId: string; at: number } | null = null

  constructor(private nav: Nav, private sessionId: string) {
    this.ticker = setInterval(() => this.tick(), 1000)
  }

  private session(): Session | null {
    return findSession(this.nav.store.activeWorkshop(), this.sessionId)
  }

  private timeText(): string {
    const s = this.session()
    if (!s) return 'Session nicht gefunden'
    const t = mmss(elapsedSec(s))
    return s.pausedAt ? `${t}   PAUSE` : t
  }

  page(): PageSpec {
    const s = this.session()
    const paused = !!s?.pausedAt
    return {
      texts: [
        { ...TIME, content: this.timeText(), x: 0, y: 0, w: 576, h: 80, textColor: 2, padding: 10, capture: true },
        { ...CONFIRM, content: this.confirmText || ' ', x: 0, y: 100, w: 576, h: 60, textColor: DIM, padding: 10 },
        { id: 3, name: 'hint', content: '● stark   ●● besprechen   Menü: Pause, Beenden', x: 0, y: 248, w: 576, h: 40, textColor: 0, padding: 6 },
      ],
      menu: [
        { id: MENU.SESSION_PAUSE, label: paused ? 'Weiter' : 'Pause' },
        { id: MENU.SESSION_END, label: 'Session beenden' },
        MENU_EXIT,
      ],
    }
  }

  private tick() {
    this.nav.updateText(TIME.id, TIME.name, this.timeText())
  }

  private confirm(text: string) {
    this.confirmText = text
    this.nav.updateText(CONFIRM.id, CONFIRM.name, text)
    if (this.confirmTimer) clearTimeout(this.confirmTimer)
    this.confirmTimer = setTimeout(() => {
      this.confirmText = ''
      this.nav.updateText(CONFIRM.id, CONFIRM.name, ' ')
    }, CONFIRM_MS)
  }

  private mark(kind: MarkerKind): void {
    const s = this.session()
    if (!s || s.status !== 'running') return
    if (s.pausedAt) return this.confirm('Pause – kein Marker')
    const now = Date.now()
    if (kind === 'besprechen' && this.lastTap && now - this.lastTap.at < DOUBLE_GRACE_MS) {
      // Der Einfachtipp gehörte zum Doppeltipp: seinen Marker wieder entfernen.
      removeMarker(this.nav.store, this.sessionId, this.lastTap.markerId)
      this.lastTap = null
    }
    const m = addMarker(this.nav.store, this.sessionId, kind, now)
    if (!m) return
    if (kind === 'stark') this.lastTap = { markerId: m.id, at: now }
    this.confirm(`● ${MARKER_LABEL[kind]}  ${mmss(m.t)}`)
  }

  private end() {
    endSession(this.nav.store, this.sessionId)
    this.nav.replace(new ReviewScreen(this.nav, this.sessionId))
  }

  onInput(input: GlassesInput) {
    switch (input.kind) {
      case 'tap':
        return this.mark('stark')
      case 'double':
        return this.mark('besprechen')
      case 'menu':
        if (input.itemId === MENU.SESSION_PAUSE) {
          const paused = togglePause(this.nav.store, this.sessionId)
          this.confirmText = paused ? 'Pause' : 'Weiter'
          return this.nav.render()
        }
        if (input.itemId === MENU.SESSION_END) return this.end()
        if (input.itemId === MENU.EXIT) {
          // Session sauber abschließen, bevor die App endet.
          endSession(this.nav.store, this.sessionId)
          return this.nav.exitApp()
        }
        return
      default:
        return
    }
  }

  onLeave() {
    if (this.ticker) clearInterval(this.ticker)
    if (this.confirmTimer) clearTimeout(this.confirmTimer)
    this.ticker = null
  }
}
