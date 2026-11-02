// Hilfsfunktionen rund um Personen: Kurznamen, Reihenfolge, Sitzbereiche, Zeitleiste.
import { MARKER_LABEL, type Participant, type Seat, type SeatLayout, type Workshop } from './model'

/**
 * Kurznamen für die Brille: Vorname; bei gleichen Vornamen mit Initiale des Nachnamens
 * ("Matthias B." / "Matthias G."). Ein gesetzter shortName hat Vorrang.
 */
export function shortNames(people: Participant[]): Map<string, string> {
  const first = (p: Participant) => p.name.trim().split(/\s+/)[0] ?? p.name
  const counts = new Map<string, number>()
  for (const p of people) if (!p.shortName) counts.set(first(p), (counts.get(first(p)) ?? 0) + 1)
  const out = new Map<string, string>()
  for (const p of people) {
    if (p.shortName?.trim()) {
      out.set(p.id, p.shortName.trim())
      continue
    }
    const f = first(p)
    const parts = p.name.trim().split(/\s+/)
    const last = parts.length > 1 ? parts[parts.length - 1] : ''
    out.set(p.id, (counts.get(f) ?? 0) > 1 && last ? `${f} ${last[0]}.` : f)
  }
  return out
}

/** Sitzbereich für die schematische Darstellung. */
export type AreaKey = string

export interface Area {
  key: AreaKey
  label: string
  /** Plätze in Anzeigereihenfolge */
  seats: Seat[]
  /** horizontal (eine Zeile) oder vertikal (eine Person je Zeile) */
  orientation: 'h' | 'v'
}

/**
 * Teilt das Layout in Bereiche, so wie die Trainerin / der Trainer den Raum sieht
 * (Stirnseite oben, eigene Position unten).
 */
export function areasOf(layout: SeatLayout): Area[] {
  const { rows, cols } = layout
  if (layout.kind === 'u') {
    const back: Seat[] = []
    for (let c = 2; c < cols; c++) back.push({ row: rows, col: c })
    const left: Seat[] = []
    const right: Seat[] = []
    // von hinten (oben) nach vorne (unten); Ecken zählen zu den Seiten
    for (let r = rows; r >= 1; r--) {
      left.push({ row: r, col: 1 })
      right.push({ row: r, col: cols })
    }
    return [
      { key: 'back', label: 'Stirnseite', seats: back, orientation: 'h' },
      { key: 'left', label: 'links', seats: left, orientation: 'v' },
      { key: 'right', label: 'rechts', seats: right, orientation: 'v' },
    ]
  }
  const out: Area[] = []
  // Reihen bzw. Tische: hinterste Reihe oben, vorderste unten
  for (let r = rows; r >= 1; r--) {
    const seats: Seat[] = []
    for (let c = 1; c <= cols; c++) seats.push({ row: r, col: c })
    out.push({ key: `r${r}`, label: layout.kind === 'tables' ? `Tisch ${r}` : `Reihe ${r}`, seats, orientation: 'h' })
  }
  if (layout.kind === 'tables') out.reverse() // Tische in Nummernfolge
  return out
}

/** Reihenfolge für die Ring-Navigation: Vorstellungsrunde, sonst einmal um den Raum. */
export function navigationOrder(ws: Workshop): Participant[] {
  const people = ws.participants
  const withOrder = people.filter(p => p.introOrder != null)
  if (withOrder.length === people.length && people.length > 0) {
    return [...people].sort((a, b) => (a.introOrder ?? 0) - (b.introOrder ?? 0))
  }
  // Fallback: Plätze in Raumreihenfolge, danach Personen ohne Platz
  const index = new Map<string, number>()
  let i = 0
  const areas = areasOf(ws.layout)
  const seq =
    ws.layout.kind === 'u'
      ? [...areas[1].seats.slice().reverse(), ...areas[0].seats, ...areas[2].seats] // links vorne→hinten, Stirnseite, rechts hinten→vorne
      : areas.flatMap(a => a.seats)
  for (const s of seq) index.set(`${s.row}/${s.col}`, i++)
  const key = (p: Participant) => (p.seat ? (index.get(`${p.seat.row}/${p.seat.col}`) ?? 9999) : 10000)
  return [...people].sort((a, b) => (a.introOrder ?? key(a) + 1000) - (b.introOrder ?? key(b) + 1000) || key(a) - key(b))
}

export interface TimelineEntry {
  at: string
  label: string
  text?: string
  source: 'session' | 'note'
  id: string
}

/** Alle Rückmeldungen zu einer Person: Session-Marker und Personen-Notizen, zeitlich sortiert. */
export function personTimeline(ws: Workshop, participantId: string): TimelineEntry[] {
  const out: TimelineEntry[] = []
  for (const s of ws.sessions) {
    if (s.participantId !== participantId) continue
    const start = new Date(s.startedAt).getTime()
    for (const m of s.markers)
      out.push({ at: new Date(start + m.t * 1000).toISOString(), label: `Rede: ${MARKER_LABEL[m.kind]}`, text: m.excerpt, source: 'session', id: m.id })
  }
  for (const n of ws.notes) {
    if (n.participantId !== participantId) continue
    const label = n.kind === 'notiz' ? 'Sprachnotiz' : n.kind
    out.push({ at: n.at, label, text: n.text, source: 'note', id: n.id })
  }
  return out.sort((a, b) => a.at.localeCompare(b.at))
}

/** Kurze Zählung für die Brille, z. B. "3× stark, 1× besprechen, 2 Notizen". */
export function feedbackCounts(ws: Workshop, participantId: string): string {
  let stark = 0
  let besprechen = 0
  let notes = 0
  for (const s of ws.sessions) if (s.participantId === participantId) for (const m of s.markers) m.kind === 'stark' ? stark++ : besprechen++
  for (const n of ws.notes) {
    if (n.participantId !== participantId) continue
    if (n.kind === 'stark') stark++
    else if (n.kind === 'besprechen') besprechen++
    else notes++
  }
  const parts = [`${stark}× stark`, `${besprechen}× besprechen`]
  if (notes) parts.push(`${notes} Notiz${notes > 1 ? 'en' : ''}`)
  return parts.join(', ')
}

/** Offene Prüfhinweise eines Workshops. */
export function openChecks(ws: Workshop): number {
  return ws.participants.filter(p => p.nameCheck || p.seatCheck).length
}
