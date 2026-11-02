import { areasOf, navigationOrder, shortNames } from '../../data/people'
import type { Participant, Workshop } from '../../data/model'
import type { GlassesInput } from '../input'
import { clip, type PageSpec, type TextSpec } from '../page'
import type { Nav, Screen } from '../nav'
import { MENU, MENU_EXIT, MENU_HOME, NORMAL } from './common'
import { ProfileScreen } from './profile'

const INFO = { id: 1, name: 'info' }
const MAX_AREAS = 6
const SEAT_DIM = 2

/**
 * Schematischer Sitzplan aus Textcontainern, so angeordnet wie im Raum
 * (Stirnseite bzw. hinterste Reihe oben, Trainer unten).
 * Wischen: nächste/vorige Person in Rundenreihenfolge. Tipp: Kurzprofil.
 */
export class SeatMapScreen implements Screen {
  isSeatMap = true
  private selectedId: string | null = null
  private filterIndex = -1 // -1 = alle, sonst Index in ws.groups

  constructor(private nav: Nav, selectedId?: string) {
    this.selectedId = selectedId ?? null
  }

  private ws(): Workshop | null {
    return this.nav.store.activeWorkshop()
  }

  private filterGroupId(ws: Workshop): string | null {
    return this.filterIndex >= 0 ? (ws.groups[this.filterIndex]?.id ?? null) : null
  }

  /** Personen in Navigationsreihenfolge, ggf. nach Gruppe gefiltert. */
  private order(ws: Workshop): Participant[] {
    const gid = this.filterGroupId(ws)
    const all = navigationOrder(ws)
    return gid ? all.filter(p => p.groupId === gid) : all
  }

  private selected(ws: Workshop): Participant | null {
    const order = this.order(ws)
    return order.find(p => p.id === this.selectedId) ?? order[0] ?? null
  }

  /** Inhalte der Bereichs-Container (id ab 2). */
  private areaTexts(ws: Workshop): TextSpec[] {
    const names = shortNames(ws.participants)
    const sel = this.selected(ws)
    const gid = this.filterGroupId(ws)
    const label = (p: Participant | undefined) => {
      if (!p) return '·'
      const n = names.get(p.id) ?? p.name
      if (sel && p.id === sel.id) return `▶${n}`
      if (gid && p.groupId === gid) return `●${n}`
      return n
    }
    const at = (row: number, col: number) => ws.participants.find(p => p.seat?.row === row && p.seat?.col === col)
    const areas = areasOf(ws.layout)
    const texts: TextSpec[] = []
    if (ws.layout.kind === 'u') {
      const [back, left, right] = areas
      // Stirnseite ohne Ecken, Seiten mit Ecken; leere Ecken weglassen
      const side = (a: typeof left) => a.seats.map((s, i) => (i === 0 && !at(s.row, s.col) ? '' : label(at(s.row, s.col)))).join('\n').replace(/^\n/, ' \n')
      texts.push({ id: 2, name: 'back', content: back.seats.map(s => label(at(s.row, s.col))).join('   '), x: 150, y: 0, w: 276, h: 60, textColor: SEAT_DIM, padding: 4 })
      texts.push({ id: 3, name: 'left', content: side(left), x: 0, y: 0, w: 150, h: 210, textColor: SEAT_DIM, padding: 4 })
      texts.push({ id: 4, name: 'right', content: side(right), x: 426, y: 0, w: 150, h: 210, textColor: SEAT_DIM, padding: 4 })
      return texts
    }
    if (areas.length > MAX_AREAS) {
      // Zu viele Reihen für eigene Container: alles in einem Block
      const content = areas.map(a => `${a.label}: ${a.seats.map(s => label(at(s.row, s.col))).join(' ')}`).join('\n')
      return [{ id: 2, name: 'rows', content, x: 0, y: 0, w: 576, h: 210, textColor: SEAT_DIM, padding: 4 }]
    }
    const h = Math.floor(210 / areas.length)
    areas.forEach((a, i) => {
      const prefix = ws.layout.kind === 'tables' ? `T${a.key.slice(1)}: ` : ''
      texts.push({ id: 2 + i, name: `a${i}`, content: prefix + a.seats.map(s => label(at(s.row, s.col))).join('  '), x: 0, y: i * h, w: 576, h, textColor: SEAT_DIM, padding: 4 })
    })
    return texts
  }

  private info(ws: Workshop): string {
    const sel = this.selected(ws)
    const order = this.order(ws)
    const g = this.filterGroupId(ws) ? ws.groups[this.filterIndex] : null
    if (!sel) return g ? `Filter ${g.label}: niemand` : 'Keine Teilnehmenden (iPhone)'
    const pos = `${order.indexOf(sel) + 1}/${order.length}`
    const role = sel.profile?.role ? ` · ${clip(sel.profile.role, 38)}` : ''
    const board = sel.profile?.board ? `\n» ${clip(sel.profile.board, 60)}` : sel.seat ? '' : '\n(kein Platz)'
    const filter = g ? ` [${clip(g.label, 14)}]` : ''
    return `${clip(sel.name, 28)}${role}  ${pos}${filter}${board}`
  }

  page(): PageSpec {
    const ws = this.ws()
    if (!ws) return { texts: [{ ...INFO, content: 'Kein Workshop gewählt (iPhone)', capture: true }], menu: [MENU_HOME, MENU_EXIT] }
    const menu = [MENU_HOME]
    if (ws.groups.length) menu.unshift({ id: MENU.FILTER, label: 'Filter wechseln' })
    menu.push(MENU_EXIT)
    return {
      texts: [...this.areaTexts(ws), { ...INFO, content: this.info(ws), x: 0, y: 214, w: 576, h: 74, textColor: NORMAL, padding: 6, capture: true }],
      menu,
    }
  }

  private refresh() {
    const ws = this.ws()
    if (!ws) return
    for (const t of this.areaTexts(ws)) this.nav.updateText(t.id, t.name, t.content)
    this.nav.updateText(INFO.id, INFO.name, this.info(ws))
  }

  private move(delta: number) {
    const ws = this.ws()
    if (!ws) return
    const order = this.order(ws)
    if (order.length === 0) return
    const cur = this.selected(ws)
    const i = cur ? order.indexOf(cur) : -1
    this.selectedId = order[(i + delta + order.length) % order.length].id
    this.refresh()
  }

  onInput(input: GlassesInput) {
    const ws = this.ws()
    switch (input.kind) {
      case 'up':
        return this.move(-1)
      case 'down':
        return this.move(1)
      case 'tap': {
        const sel = ws ? this.selected(ws) : null
        if (sel) this.nav.push(new ProfileScreen(this.nav, sel.id, id => (this.selectedId = id)))
        return
      }
      case 'double':
        return this.nav.depth() > 1 ? this.nav.pop() : undefined
      case 'menu':
        if (input.itemId === MENU.EXIT) return this.nav.exitApp()
        if (input.itemId === MENU.HOME) return this.nav.depth() > 1 ? this.nav.pop() : undefined
        if (input.itemId === MENU.FILTER && ws) {
          this.filterIndex = this.filterIndex + 1 >= ws.groups.length ? -1 : this.filterIndex + 1
          const order = this.order(ws)
          if (!order.some(p => p.id === this.selectedId)) this.selectedId = order[0]?.id ?? null
          return this.nav.render()
        }
        return
      default:
        return
    }
  }
}

