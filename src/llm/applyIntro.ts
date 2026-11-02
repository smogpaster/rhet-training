// Überträgt das Ergebnis der Auswertung in den Workshop. Nichts wird still entschieden:
// Unsicherheiten aus der Auswertung und Platzkonflikte landen als Prüfhinweis an der Person.
import { emptyProfile, newGroup, newParticipant, type Participant, type Seat, type SeatLayout, type Workshop } from '../data/model'
import type { IntroPerson, IntroResult, SeatRef } from './introSchema'

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]+/g, ' ')
    .trim()
}

/** Leitet aus den Sitzangaben die Layoutgröße ab. */
export function layoutFor(kind: SeatLayout['kind'], refs: SeatRef[], current: SeatLayout): SeatLayout {
  const max = (f: (r: SeatRef) => number, area?: (a: SeatRef['area']) => boolean) => Math.max(0, ...refs.filter(r => !area || area(r.area)).map(f))
  if (kind === 'u') {
    const side = max(r => r.position, a => a === 'links' || a === 'rechts')
    const back = max(r => r.position, a => a === 'stirnseite')
    return { kind, rows: Math.max(side + 1, 2), cols: Math.max(back + 2, 3) }
  }
  const rows = max(r => r.group)
  const cols = max(r => r.position)
  return { kind, rows: Math.max(rows, 1, kind === current.kind ? 0 : 1), cols: Math.max(cols, 1) }
}

/** Übersetzt einen Sitzbezug in Reihe/Spalte des Layouts. */
export function seatFor(layout: SeatLayout, ref: SeatRef): Seat | null {
  if (ref.position < 1) return null
  if (layout.kind === 'u') {
    if (ref.area === 'links') return { row: ref.position, col: 1 }
    if (ref.area === 'rechts') return { row: ref.position, col: layout.cols }
    if (ref.area === 'stirnseite') return { row: layout.rows, col: ref.position + 1 }
    return null
  }
  if (ref.group < 1) return null
  return { row: ref.group, col: ref.position }
}

export interface ApplySummary {
  created: number
  updated: number
  checks: number
}

/** Wendet das Ergebnis auf den Workshop an (verändert ws). */
export function applyIntroResult(ws: Workshop, result: IntroResult, question: string): ApplySummary {
  const summary: ApplySummary = { created: 0, updated: 0, checks: 0 }
  ws.layout = layoutFor(result.layoutKind, result.people.flatMap(p => (p.seat ? [p.seat] : [])), ws.layout)

  // Gruppen nach Bezeichnung zuordnen bzw. anlegen
  const groupId = (label: string): string | null => {
    const l = label.trim()
    if (!l) return null
    let g = ws.groups.find(x => x.label.toLowerCase() === l.toLowerCase())
    if (!g) {
      g = newGroup(l, ws.groups.length)
      ws.groups.push(g)
    }
    return g.id
  }
  for (const label of result.groups) groupId(label)

  // Bestehende Personen über alle bekannten Schreibweisen finden
  const find = (p: IntroPerson): Participant | undefined => {
    const keys = new Set([p.name, p.nameTranscript, p.namePlan, ...p.nameOptions].filter(Boolean).map(normalizeName))
    return ws.participants.find(x => keys.has(normalizeName(x.name)))
  }

  const taken = new Map<string, string>()
  for (const person of [...result.people].sort((a, b) => a.introOrder - b.introOrder)) {
    let target = find(person)
    if (!target) {
      target = newParticipant(person.name)
      ws.participants.push(target)
      summary.created++
    } else summary.updated++

    target.name = person.name || target.name
    target.introOrder = person.introOrder > 0 ? person.introOrder : null
    target.groupId = groupId(person.group) ?? target.groupId ?? null
    target.profile = {
      ...emptyProfile(),
      role: person.role,
      experience: person.experience,
      area: person.area,
      background: person.background,
      answer: person.answer,
      board: person.board,
      tip: person.tip,
      evidence: person.evidence,
    }
    target.nameCheck = person.nameCheck.trim() || undefined
    target.nameOptions = target.nameCheck ? unique([person.name, ...person.nameOptions]) : undefined

    const checks: string[] = []
    if (person.seatCheck.trim()) checks.push(person.seatCheck.trim())
    let seat = person.seat ? seatFor(ws.layout, person.seat) : null
    if (person.seat && !seat) checks.push('Platzangabe passt nicht zum Sitzplan')
    if (seat) {
      const key = `${seat.row}/${seat.col}`
      const other = taken.get(key)
      if (other) {
        checks.push(`Platz doppelt vergeben (auch ${other})`)
        seat = null
      } else taken.set(key, target.name)
    } else if (!person.seat) checks.push('Kein Platz auf dem Sitzplan gefunden')
    target.seat = seat
    target.seatCheck = checks.length ? checks.join('; ') : undefined
    if (target.nameCheck || target.seatCheck) summary.checks++
  }

  // Namen nur auf dem Plan: als Person mit Prüfhinweis anlegen, damit nichts verloren geht
  for (const name of result.planOnlyNames) {
    if (ws.participants.some(p => normalizeName(p.name) === normalizeName(name))) continue
    ws.participants.push({ ...newParticipant(name), nameCheck: 'Steht auf dem Sitzplan, aber nicht im Transkript', seatCheck: 'Platz bitte von Hand setzen' })
    summary.created++
    summary.checks++
  }

  ws.intro = {
    ...ws.intro,
    question,
    overview: result.overview,
    expectations: result.expectations,
    analyzedAt: new Date().toISOString(),
  }
  return summary
}

function unique(list: string[]): string[] {
  return [...new Set(list.map(s => s.trim()).filter(Boolean))]
}
