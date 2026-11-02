import type { Participant, PersonGroup, Seat, SeatLayout } from '../data/model'
import { isSeatCell, sameSeat } from '../data/seats'

interface Props {
  layout: SeatLayout
  participants: Participant[]
  groups?: PersonGroup[]
  /** hervorgehobener Platz (z. B. der Person im Formular) */
  selected: Seat | null
  onPick?: (seat: Seat) => void
}

/** Sitzplan als Raster aus Sicht des Trainers: Stirnseite bzw. hinterste Reihe oben, vorne unten. */
export function SeatPlan({ layout, participants, groups = [], selected, onPick }: Props) {
  const cells = []
  const rowOrder = layout.kind === 'tables' ? [...Array(layout.rows)].map((_, i) => i + 1) : [...Array(layout.rows)].map((_, i) => layout.rows - i)
  for (const row of rowOrder) {
    if (layout.kind === 'tables') cells.push(<div key={`t${row}`} class="seat-label">Tisch {row}</div>)
    for (let col = 1; col <= layout.cols; col++) {
      const seat = { row, col }
      if (!isSeatCell(layout, row, col)) {
        cells.push(<div key={`${row}-${col}`} class="seat none" />)
        continue
      }
      const p = participants.find(x => sameSeat(x.seat, seat))
      const group = p?.groupId ? groups.find(g => g.id === p.groupId) : undefined
      const cls = ['seat', p ? '' : 'empty', sameSeat(selected, seat) ? 'selected' : '', p?.nameCheck || p?.seatCheck ? 'check' : ''].join(' ')
      cells.push(
        <div
          key={`${row}-${col}`}
          class={cls}
          style={group ? { borderLeft: `4px solid ${group.color}` } : undefined}
          onClick={onPick ? () => onPick(seat) : undefined}
          role={onPick ? 'button' : undefined}
        >
          {p ? (
            <span>
              {p.introOrder ? <small class="nr">{p.introOrder}</small> : null}
              {p.name}
            </span>
          ) : (
            `${row}/${col}`
          )}
        </div>,
      )
    }
  }
  const cols = layout.kind === 'tables' ? `5.5em repeat(${layout.cols}, 1fr)` : `repeat(${layout.cols}, 1fr)`
  return (
    <div class="seatplan" style={{ gridTemplateColumns: cols }}>
      {layout.kind !== 'tables' && <div class="seat front">{layout.kind === 'u' ? 'Stirnseite' : 'hinten'}</div>}
      {cells}
      <div class="seat front">{layout.kind === 'u' ? 'offene Seite · Trainer' : 'vorne · Trainer'}</div>
    </div>
  )
}
