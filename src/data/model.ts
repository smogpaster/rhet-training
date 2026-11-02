// Datenmodell der App. Alles wird als JSON lokal gespeichert (siehe store.ts).

/**
 * Sitzplan-Layout eines Workshops.
 * - grid: Reihen (rows) × Plätze je Reihe (cols), Reihe 1 vorne beim Trainer
 * - u: U-Form, linke Spalte (col 1), rechte Spalte (col = cols), Stirnseite (row = rows);
 *      offene Seite vorne beim Trainer
 * - tables: Tischgruppen, row = Tischnummer, col = Platz am Tisch
 */
export interface SeatLayout {
  kind: 'grid' | 'u' | 'tables'
  rows: number
  cols: number
}

/** Sitzplatz, 1-basiert (Reihe 1 = vorne beim Trainer). */
export interface Seat {
  row: number
  col: number
}

/** Profil aus der Vorstellungsrunde. Leere Felder = nicht gesagt. */
export interface Profile {
  role: string
  experience: string
  area: string
  background: string
  /** Antwort auf die Einstiegsfrage (z. B. bester Türöffner), ausführlich */
  answer: string
  /** Tafel-Stichwort, kurz – erscheint auf der Brille */
  board: string
  /** Hinweis für den Seminartag (Vorschlag, aus dem Gesagten abgeleitet) */
  tip: string
  /** Belegzitate aus dem Transkript */
  evidence: string
}

export interface Participant {
  id: string
  name: string
  seat: Seat | null
  /** eigene Notiz der Trainerin / des Trainers */
  note: string
  /** Kurzname für die Brille; leer = automatisch */
  shortName?: string
  /** Personengruppe (id aus Workshop.groups) */
  groupId?: string | null
  /** Position in der Vorstellungsrunde, 1-basiert */
  introOrder?: number | null
  profile?: Profile
  /** Offene Prüfhinweise, z. B. abweichende Schreibweise. Leer = geprüft. */
  nameCheck?: string
  /** vollständige Namensvarianten zur Auswahl, wenn nameCheck gesetzt ist */
  nameOptions?: string[]
  seatCheck?: string
}

export interface PersonGroup {
  id: string
  label: string
  /** Farbe für iPhone und Export */
  color: string
}

/** Feedback-Marker oder Notiz direkt an einer Person, außerhalb einer Rede-Session. */
export interface PersonNote {
  id: string
  participantId: string
  /** ISO-Zeitstempel */
  at: string
  kind: 'stark' | 'besprechen' | 'notiz'
  /** Text der Notiz bzw. Transkript der Sprachnotiz */
  text?: string
  /** Sprachnotiz liegt als Aufnahme vor */
  hasAudio?: boolean
  /** Status der Transkription */
  transcription?: 'pending' | 'done' | 'failed'
}

/** Gruppenebene aus der Vorstellungsrunde. */
export interface IntroInfo {
  question: string
  /** Transkript der Runde; wird nach dem Übernehmen gelöscht, wenn so eingestellt */
  transcript: string
  overview: string
  expectations: string[]
  analyzedAt?: string
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
  /** Summe bisheriger Pausen in Sekunden */
  pausedSec: number
  /** ISO-Zeitstempel, wenn gerade pausiert, sonst null */
  pausedAt: string | null
  markers: Marker[]
  transcript?: TranscriptWord[]
  /** true, sobald eine Aufnahme in IndexedDB liegt; false nach dem Löschen */
  hasAudio?: boolean
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
  groups: PersonGroup[]
  notes: PersonNote[]
  intro: IntroInfo
}

export interface Settings {
  autoDeleteAudio: boolean
  /** Bring your own key: lokal gespeichert, nie exportiert */
  claudeApiKey: string
  openaiApiKey: string
  /** Transkript der Vorstellungsrunde nach dem Übernehmen behalten */
  keepIntroTranscript: boolean
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
  return { version: 1, workshops: [], activeWorkshopId: null, settings: defaultSettings() }
}

export function defaultSettings(): Settings {
  return { autoDeleteAudio: true, claudeApiKey: '', openaiApiKey: '', keepIntroTranscript: false }
}

export function emptyProfile(): Profile {
  return { role: '', experience: '', area: '', background: '', answer: '', board: '', tip: '', evidence: '' }
}

export function emptyIntro(): IntroInfo {
  return { question: '', transcript: '', overview: '', expectations: [] }
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
    groups: [],
    notes: [],
    intro: emptyIntro(),
  }
}

export function newParticipant(name: string, note = '', seat: Seat | null = null): Participant {
  return { id: newId(), name: name.trim(), note: note.trim(), seat }
}

/** Farbpalette für Personengruppen (auf dunklem Grund gut unterscheidbar). */
export const GROUP_COLORS = ['#7FA9C4', '#A3BD72', '#C79AD6', '#E0B04C', '#E07A6A', '#6CC4B4', '#B0B0B0']

export function newGroup(label: string, index: number): PersonGroup {
  return { id: newId(), label: label.trim(), color: GROUP_COLORS[index % GROUP_COLORS.length] }
}

/** Ergänzt fehlende Felder älterer Datenstände. */
export function migrate(data: AppData): AppData {
  data.settings = { ...defaultSettings(), ...(data.settings ?? {}) }
  for (const w of data.workshops) {
    w.groups ??= []
    w.notes ??= []
    w.intro = { ...emptyIntro(), ...(w.intro ?? {}) }
    for (const s of w.sessions) {
      s.pausedSec ??= 0
      s.pausedAt ??= null
    }
  }
  return data
}
