import type { Seat, SeatLayout } from './model'

/** Ist die Zelle (row, col) im Layout ein Sitzplatz? */
export function isSeatCell(layout: SeatLayout, row: number, col: number): boolean {
  if (row < 1 || col < 1 || row > layout.rows || col > layout.cols) return false
  if (layout.kind === 'grid') return true
  // U-Form: linke Spalte, rechte Spalte und hinterste Reihe (offene Seite vorne beim Trainer)
  return col === 1 || col === layout.cols || row === layout.rows
}

/** Alle Sitzplätze eines Layouts in Lesereihenfolge. */
export function seatsOf(layout: SeatLayout): Seat[] {
  const out: Seat[] = []
  for (let row = 1; row <= layout.rows; row++)
    for (let col = 1; col <= layout.cols; col++) if (isSeatCell(layout, row, col)) out.push({ row, col })
  return out
}

/** Kurze, für die Brille geeignete Bezeichnung eines Sitzplatzes. */
export function seatLabel(layout: SeatLayout, seat: Seat | null): string {
  if (!seat) return 'kein Platz'
  if (layout.kind === 'grid') return `Reihe ${seat.row}, Platz ${seat.col}`
  if (seat.row === layout.rows && seat.col > 1 && seat.col < layout.cols) return `hinten ${seat.col - 1}`
  if (seat.col === 1) return `links ${seat.row}`
  if (seat.col === layout.cols) return `rechts ${seat.row}`
  return `Reihe ${seat.row}, Platz ${seat.col}`
}

export function sameSeat(a: Seat | null, b: Seat | null): boolean {
  return !!a && !!b && a.row === b.row && a.col === b.col
}

/** Parst Angaben wie "2/3", "2-3", "R2 P3", "Reihe 2 Platz 3" zu einem Sitzplatz. */
export function parseSeat(text: string): Seat | null {
  const nums = text.match(/\d+/g)
  if (!nums || nums.length < 2) return null
  const row = Number(nums[0])
  const col = Number(nums[1])
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 1 || col < 1) return null
  return { row, col }
}

export function seatToText(seat: Seat | null): string {
  return seat ? `${seat.row}/${seat.col}` : ''
}
