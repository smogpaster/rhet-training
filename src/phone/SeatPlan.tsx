import type { Participant, Seat, SeatLayout } from '../data/model'
import { isSeatCell, sameSeat } from '../data/seats'

interface Props {
  layout: SeatLayout
  participants: Participant[]
  /** Sitzplatz der gerade bearbeiteten Person (hervorgehoben) */
  selected: Seat | null
  onPick?: (seat: Seat) => void
}

/** Sitzplan als Raster. Reihe 1 ist vorne beim Trainer. */
export function SeatPlan({ layout, participants, selected, onPick }: Props) {
  const rows = []
  for (let row = 1; row <= layout.rows; row++) {
    for (let col = 1; col <= layout.cols; col++) {
      const seat = { row, col }
      if (!isSeatCell(layout, row, col)) {
        rows.push(<div key={`${row}-${col}`} class="seat none" />)
        continue
      }
      const occupant = participants.find(p => sameSeat(p.seat, seat))
      const cls = ['seat', occupant ? '' : 'empty', sameSeat(selected, seat) ? 'selected' : ''].join(' ')
      rows.push(
        <div key={`${row}-${col}`} class={cls} onClick={onPick ? () => onPick(seat) : undefined} role={onPick ? 'button' : undefined}>
          {occupant ? occupant.name : `${row}/${col}`}
        </div>,
      )
    }
  }
  return (
    <div class="seatplan" style={{ gridTemplateColumns: `repeat(${layout.cols}, 1fr)` }}>
      <div class="seat front">vorne (Trainer)</div>
      {rows}
    </div>
  )
}
