import { newParticipant, type Participant } from './model'
import { parseSeat } from './seats'

export interface CsvImportResult {
  participants: Participant[]
  /** Zeilen, die nicht verarbeitet werden konnten (1-basierte Zeilennummer + Grund) */
  errors: string[]
}

/** Zerlegt eine CSV-Zeile mit dem gegebenen Trennzeichen, Anführungszeichen werden berücksichtigt. */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') inQuotes = false
      else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === delimiter) {
      cells.push(cur)
      cur = ''
    } else cur += ch
  }
  cells.push(cur)
  return cells.map(c => c.trim())
}

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 5).join('\n')
  const counts: Array<[string, number]> = [';', ',', '\t'].map(d => [d, (sample.split(d).length - 1) as number])
  counts.sort((a, b) => b[1] - a[1])
  return counts[0][1] > 0 ? counts[0][0] : ';'
}

const NAME_HEADERS = ['name', 'teilnehmer', 'teilnehmerin', 'teilnehmende', 'person']
const SEAT_HEADERS = ['sitzplatz', 'platz', 'seat', 'sitz']
const NOTE_HEADERS = ['notiz', 'notizen', 'note', 'notes', 'bemerkung', 'anmerkung']

/**
 * Importiert Teilnehmende aus CSV-Text.
 * Erwartete Spalten: Name; Sitzplatz (optional, z. B. "2/3"); Notiz (optional).
 * Eine Kopfzeile wird erkannt, wenn sie eine der bekannten Spaltenüberschriften enthält.
 */
export function parseParticipantsCsv(text: string): CsvImportResult {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter(l => l.trim().length > 0)
  const result: CsvImportResult = { participants: [], errors: [] }
  if (lines.length === 0) return result

  const delimiter = detectDelimiter(lines)
  let nameIdx = 0
  let seatIdx = 1
  let noteIdx = 2
  let start = 0

  const first = splitCsvLine(lines[0], delimiter).map(c => c.toLowerCase())
  const hasHeader = first.some(c => NAME_HEADERS.includes(c) || SEAT_HEADERS.includes(c) || NOTE_HEADERS.includes(c))
  if (hasHeader) {
    start = 1
    const find = (names: string[], fallback: number) => {
      const i = first.findIndex(c => names.includes(c))
      return i >= 0 ? i : fallback
    }
    nameIdx = find(NAME_HEADERS, 0)
    seatIdx = find(SEAT_HEADERS, -1)
    noteIdx = find(NOTE_HEADERS, -1)
  }

  for (let i = start; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i], delimiter)
    const name = cells[nameIdx] ?? ''
    if (!name) {
      result.errors.push(`Zeile ${i + 1}: kein Name`)
      continue
    }
    const seatText = seatIdx >= 0 ? (cells[seatIdx] ?? '') : ''
    const seat = seatText ? parseSeat(seatText) : null
    if (seatText && !seat) result.errors.push(`Zeile ${i + 1}: Sitzplatz "${seatText}" nicht verstanden, Person ohne Platz importiert`)
    const note = noteIdx >= 0 ? (cells[noteIdx] ?? '') : ''
    result.participants.push(newParticipant(name, note, seat))
  }
  return result
}
