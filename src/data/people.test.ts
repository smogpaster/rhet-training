import { describe, expect, it } from 'vitest'
import { newParticipant, newWorkshop } from './model'
import { areasOf, feedbackCounts, navigationOrder, shortNames } from './people'

describe('shortNames', () => {
  it('uses first names and disambiguates duplicates', () => {
    const a = newParticipant('Matthias Bucher')
    const b = newParticipant('Matthias Göttlicher')
    const c = newParticipant('Udo Peters')
    const d = { ...newParticipant('Tarik Altaki'), shortName: 'Tarik A' }
    const m = shortNames([a, b, c, d])
    expect(m.get(a.id)).toBe('Matthias B.')
    expect(m.get(b.id)).toBe('Matthias G.')
    expect(m.get(c.id)).toBe('Udo')
    expect(m.get(d.id)).toBe('Tarik A')
  })
})

describe('areas and order', () => {
  it('splits a U into back, left and right', () => {
    const areas = areasOf({ kind: 'u', rows: 5, cols: 6 })
    expect(areas.map(a => a.seats.length)).toEqual([4, 5, 5])
    expect(areas[1].seats[0]).toEqual({ row: 5, col: 1 })
  })

  it('uses the intro order when all people have one', () => {
    const ws = newWorkshop('W')
    const a = { ...newParticipant('A'), introOrder: 2 }
    const b = { ...newParticipant('B'), introOrder: 1 }
    ws.participants.push(a, b)
    expect(navigationOrder(ws).map(p => p.name)).toEqual(['B', 'A'])
  })

  it('falls back to walking around the U', () => {
    const ws = newWorkshop('W')
    ws.layout = { kind: 'u', rows: 3, cols: 4 }
    ws.participants.push(
      newParticipant('Rechts', '', { row: 1, col: 4 }),
      newParticipant('Stirn', '', { row: 3, col: 2 }),
      newParticipant('LinksVorne', '', { row: 1, col: 1 }),
      newParticipant('OhnePlatz'),
    )
    expect(navigationOrder(ws).map(p => p.name)).toEqual(['LinksVorne', 'Stirn', 'Rechts', 'OhnePlatz'])
  })

  it('counts feedback from sessions and notes', () => {
    const ws = newWorkshop('W')
    const p = newParticipant('A')
    ws.participants.push(p)
    ws.notes.push({ id: 'n1', participantId: p.id, at: '2026-11-02T10:00:00Z', kind: 'stark' }, { id: 'n2', participantId: p.id, at: '2026-11-02T10:01:00Z', kind: 'notiz', text: 'x' })
    expect(feedbackCounts(ws, p.id)).toBe('1× stark, 0× besprechen, 1 Notiz')
  })
})
