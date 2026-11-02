import { feedbackCounts, navigationOrder } from '../../data/people'
import type { Participant, Workshop } from '../../data/model'
import { seatLabel } from '../../data/seats'
import { addPersonNote, removePersonNote } from '../../session/notes'
import { startSession } from '../../session/session'
import type { GlassesInput } from '../input'
import { clip, type PageSpec } from '../page'
import type { Nav, Screen } from '../nav'
import { BRIGHT, DIM, MENU, MENU_EXIT, MENU_HOME, NORMAL } from './common'
import { SessionScreen } from './session'
import { VoiceNoteScreen } from './voiceNote'

const HEAD = { id: 1, name: 'head' }
const DETAIL = { id: 2, name: 'detail' }
const STATUS = { id: 3, name: 'status' }
/** Doppeltipp kurz nach Einfachtipp: Einfachtipp war Teil davon. */
const DOUBLE_GRACE_MS = 450
/** Langes Drücken kurz nach einem Tipp: war vermutlich die Geste fürs Kontextmenü. */
const LONGPRESS_GRACE_MS = 800
const CONFIRM_MS = 3000

/**
 * Kurzprofil einer Person, in Sekunden lesbar:
 * Name, Funktion, Tafel-Stichwort hell; Erfahrung, Gebiet, Hinweis gedimmt.
 * Tipp = „stark“, Doppeltipp = „besprechen“, Wischen = nächste Person, lang drücken = Sitzplan.
 */
export class ProfileScreen implements Screen {
  /** Eigene Textupdates; ein Neuaufbau nach jedem Marker würde die Bestätigung überschreiben. */
  selfUpdating = true
  private lastTap: { noteId: string; at: number } | null = null
  private lastNoteId: string | null = null
  private confirmTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private nav: Nav, private participantId: string, private onSelect?: (id: string) => void) {}

  private ctx(): { ws: Workshop; p: Participant } | null {
    const ws = this.nav.store.activeWorkshop()
    const p = ws?.participants.find(x => x.id === this.participantId)
    return ws && p ? { ws, p } : null
  }

  private head(): string {
    const c = this.ctx()
    if (!c) return 'Person nicht gefunden'
    const { p } = c
    const lines = [p.name]
    if (p.profile?.role) lines.push(clip(p.profile.role, 60))
    lines.push(p.profile?.board ? `» ${clip(p.profile.board, 60)}` : p.profile?.answer ? `» ${clip(firstSentence(p.profile.answer), 60)}` : '')
    return lines.join('\n')
  }

  private detail(): string {
    const c = this.ctx()
    if (!c) return ' '
    const { ws, p } = c
    const facts = [p.profile?.experience, p.profile?.area, seatLabel(ws.layout, p.seat)].filter(Boolean).map(s => clip(s!, 40))
    const lines = [facts.join(' · ')]
    if (p.profile?.tip) lines.push(`Heute: ${clip(p.profile.tip, 110)}`)
    else if (p.note) lines.push(`Notiz: ${clip(p.note, 110)}`)
    return lines.join('\n')
  }

  private status(): string {
    const c = this.ctx()
    return c ? feedbackCounts(c.ws, c.p.id) : ' '
  }

  page(): PageSpec {
    return {
      texts: [
        { ...HEAD, content: this.head(), x: 0, y: 0, w: 576, h: 100, textColor: BRIGHT, padding: 6, capture: true },
        { ...DETAIL, content: this.detail(), x: 0, y: 104, w: 576, h: 140, textColor: DIM + 1, padding: 6 },
        { ...STATUS, content: this.status(), x: 0, y: 248, w: 576, h: 40, textColor: DIM, padding: 6 },
      ],
      menu: [
        { id: MENU.SEATMAP, label: 'Sitzplan' },
        { id: MENU.VOICE_NOTE, label: 'Sprachnotiz' },
        { id: MENU.UNDO_MARKER, label: 'Letzten Marker löschen' },
        { id: MENU.START_SPEECH, label: 'Rede-Session starten' },
        MENU_HOME,
        MENU_EXIT,
      ],
    }
  }

  private confirm(text: string) {
    this.nav.updateText(STATUS.id, STATUS.name, text, NORMAL)
    if (this.confirmTimer) clearTimeout(this.confirmTimer)
    this.confirmTimer = setTimeout(() => this.nav.updateText(STATUS.id, STATUS.name, this.status(), DIM), CONFIRM_MS)
  }

  private mark(kind: 'stark' | 'besprechen') {
    const c = this.ctx()
    if (!c) return
    const now = Date.now()
    if (kind === 'besprechen' && this.lastTap && now - this.lastTap.at < DOUBLE_GRACE_MS) {
      removePersonNote(this.nav.store, c.ws.id, this.lastTap.noteId)
      this.lastTap = null
    }
    const n = addPersonNote(this.nav.store, c.ws.id, c.p.id, kind, {}, now)
    this.lastNoteId = n.id
    this.lastTap = kind === 'stark' ? { noteId: n.id, at: now } : null
    this.confirm(`● ${kind}  ${new Date(now).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`)
  }

  private move(delta: number) {
    const c = this.ctx()
    if (!c) return
    const order = navigationOrder(c.ws)
    const i = order.findIndex(p => p.id === this.participantId)
    this.participantId = order[(i + delta + order.length) % order.length].id
    this.onSelect?.(this.participantId)
    this.lastTap = null
    this.nav.updateText(HEAD.id, HEAD.name, this.head())
    this.nav.updateText(DETAIL.id, DETAIL.name, this.detail())
    this.nav.updateText(STATUS.id, STATUS.name, this.status(), DIM)
  }

  onInput(input: GlassesInput) {
    const c = this.ctx()
    switch (input.kind) {
      case 'tap':
        return this.mark('stark')
      case 'double':
        return this.mark('besprechen')
      case 'up':
        return this.move(-1)
      case 'down':
        return this.move(1)
      case 'longPress':
        if (c && this.lastTap && Date.now() - this.lastTap.at < LONGPRESS_GRACE_MS) removePersonNote(this.nav.store, c.ws.id, this.lastTap.noteId)
        this.lastTap = null
        return
      case 'menu':
        if (!c) return
        if (input.itemId === MENU.SEATMAP) return this.nav.quickAccess()
        if (input.itemId === MENU.VOICE_NOTE) return this.nav.push(new VoiceNoteScreen(this.nav, c.p.id))
        if (input.itemId === MENU.UNDO_MARKER) {
          if (this.lastNoteId) removePersonNote(this.nav.store, c.ws.id, this.lastNoteId)
          this.lastNoteId = null
          return this.confirm('Letzter Marker gelöscht')
        }
        if (input.itemId === MENU.START_SPEECH) {
          if (!c.ws.consentConfirmed) return this.confirm('Erst Einwilligung auf dem iPhone bestätigen')
          const s = startSession(this.nav.store, c.ws.id, c.p.id)
          return this.nav.push(new SessionScreen(this.nav, s.id))
        }
        if (input.itemId === MENU.HOME) {
          while (this.nav.depth() > 1) this.nav.pop()
          return
        }
        if (input.itemId === MENU.EXIT) return this.nav.exitApp()
        return
      default:
        return
    }
  }

  onLeave() {
    if (this.confirmTimer) clearTimeout(this.confirmTimer)
  }
}

function firstSentence(text: string): string {
  const m = text.match(/^.+?[.!?](\s|$)/)
  return (m ? m[0] : text).trim()
}

