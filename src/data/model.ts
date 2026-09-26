// Datenmodell der App. Alles wird als JSON lokal gespeichert (siehe store.ts).

/** Sitzplan-Layout eines Workshops. Bei "u" sind nur die äußeren U-Zellen Sitzplätze. */
export interface SeatLayout {
  kind: 'grid' | 'u'
  rows: number
  cols: number
}

/** Sitzplatz, 1-basiert (Reihe 1 = vorne beim Trainer). */
export interface Seat {
  row: number
  col: number
}

export interface Participant {
  id: string
  name: string
  seat: Seat | null
  note: string
}

export type MarkerKind = 'stark' | 'besprechen'

export interface Marker {
  id: string
  /** Sekunden seit Session-Start */
  t: number
  kind: MarkerKind
  /** Transkript-Ausschnitt (ca. 10 s davor bis 5 s danach), wird nach der Transkription gefüllt */
  excerpt?: string
}

export interface TranscriptWord {
  w: string
  /** Start in Sekunden seit Session-Start */
  s: number
  /** Ende in Sekunden seit Session-Start */
  e: number
}

export interface Session {
  id: string
  workshopId: string
  participantId: string
  /** ISO-Zeitstempel */
  startedAt: string
  durationSec: number
  status: 'running' | 'ended'
  markers: Marker[]
  transcript?: TranscriptWord[]
  audioDeleted: boolean
}

export interface Workshop {
  id: string
  title: string
  /** ISO-Datum (YYYY-MM-DD) */
  date: string
  layout: SeatLayout
  consentConfirmed: boolean
  participants: Participant[]
  sessions: Session[]
}

export interface Settings {
  autoDeleteAudio: boolean
}

export interface AppData {
  version: 1
  workshops: Workshop[]
  activeWorkshopId: string | null
  settings: Settings
}

export const MARKER_LABEL: Record<MarkerKind, string> = {
  stark: 'stark',
  besprechen: 'besprechen',
}

export function emptyData(): AppData {
  return { version: 1, workshops: [], activeWorkshopId: null, settings: { autoDeleteAudio: true } }
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function newWorkshop(title: string): Workshop {
  return {
    id: newId(),
    title,
    date: todayIso(),
    layout: { kind: 'grid', rows: 3, cols: 4 },
    consentConfirmed: false,
    participants: [],
    sessions: [],
  }
}

export function newParticipant(name: string, note = '', seat: Seat | null = null): Participant {
  return { id: newId(), name: name.trim(), note: note.trim(), seat }
}
