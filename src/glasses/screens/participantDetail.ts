import { seatLabel } from '../../data/seats'
import type { Participant, Workshop } from '../../data/model'
import type { GlassesInput } from '../input'
import type { PageSpec } from '../page'
import type { Nav, Screen } from '../nav'
import { DIM, MENU, MENU_EXIT, MENU_HOME } from './common'
import type { ParticipantsOptions } from './participants'

const BODY = { id: 1, name: 'person' }
const HINT = { id: 2, name: 'hint' }

/** Zählt bisherige Marker einer Person über alle Sessions des Workshops. */
export function feedbackSummary(ws: Workshop, p: Participant): string {
  let stark = 0
  let besprechen = 0
  let sessions = 0
  for (const s of ws.sessions) {
    if (s.participantId !== p.id) continue
    sessions++
    for (const m of s.markers) m.kind === 'stark' ? stark++ : besprechen++
  }
  if (sessions === 0) return 'Noch keine Session'
  return `${sessions} Session(s): ${stark}× stark, ${besprechen}× besprechen`
}

/** Detailansicht einer Person, Wischen blättert zur nächsten/vorherigen. */
export class ParticipantDetailScreen implements Screen {
  constructor(private nav: Nav, private index: number, _options: ParticipantsOptions = {}) {}

  private current(): { ws: Workshop; p: Participant } | null {
    const ws = this.nav.store.activeWorkshop()
    const p = ws?.participants[this.index]
    return ws && p ? { ws, p } : null
  }

  private body(): string {
    const cur = this.current()
    if (!cur) return 'Person nicht gefunden'
    const { ws, p } = cur
    const n = ws.participants.length
    const lines = [
      `${p.name}   (${this.index + 1}/${n})`,
      `Platz: ${seatLabel(ws.layout, p.seat)}`,
      p.note ? `Notiz: ${p.note}` : 'Notiz: –',
      '',
      feedbackSummary(ws, p),
    ]
    return lines.join('\n')
  }

  private hint(): string {
    return '▲▼ blättern   ● Session starten   ●● zurück'
  }

  page(): PageSpec {
    return {
      texts: [
        { ...BODY, content: this.body(), x: 0, y: 0, w: 576, h: 240, capture: true },
        { ...HINT, content: this.hint(), x: 0, y: 248, w: 576, h: 40, textColor: DIM, padding: 6 },
      ],
      menu: [MENU_HOME, MENU_EXIT],
    }
  }

  private move(delta: number) {
    const n = this.nav.store.activeWorkshop()?.participants.length ?? 0
    if (n === 0) return
    this.index = (this.index + delta + n) % n
    this.nav.updateText(BODY.id, BODY.name, this.body())
  }

  onInput(input: GlassesInput) {
    switch (input.kind) {
      case 'up':
        return this.move(-1)
      case 'down':
        return this.move(1)
      case 'double':
        return this.nav.pop()
      case 'tap':
        // Meilenstein 3: Session für diese Person starten. Bis dahin nur Hinweis.
        return this.nav.updateText(HINT.id, HINT.name, 'Session-Start kommt in Meilenstein 3', DIM)
      case 'menu':
        if (input.itemId === MENU.EXIT) return this.nav.exitApp()
        if (input.itemId === MENU.HOME) {
          this.nav.pop()
          this.nav.pop()
        }
        return
      default:
        return
    }
  }
}
