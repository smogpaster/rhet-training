import { describe, expect, it } from 'vitest'
import { parseParticipantsCsv, splitCsvLine } from './csv'
import { isSeatCell, parseSeat, seatLabel, seatsOf } from './seats'
import { mmss } from './format'

describe('CSV-Import', () => {
  it('reads semicolon files with a header', () => {
    const r = parseParticipantsCsv('Name;Sitzplatz;Notiz\nAnna Müller;2/3;will an Stimme arbeiten\nBen;;\n')
    expect(r.errors).toEqual([])
    expect(r.participants.map(p => p.name)).toEqual(['Anna Müller', 'Ben'])
    expect(r.participants[0].seat).toEqual({ row: 2, col: 3 })
    expect(r.participants[0].note).toBe('will an Stimme arbeiten')
    expect(r.participants[1].seat).toBeNull()
  })

  it('reads comma files without a header and quoted cells', () => {
    const r = parseParticipantsCsv('"Meier, Clara",1-1,"sagt oft ""äh"""')
    expect(r.participants[0].name).toBe('Meier, Clara')
    expect(r.participants[0].seat).toEqual({ row: 1, col: 1 })
    expect(r.participants[0].note).toBe('sagt oft "äh"')
  })

  it('reports unparseable seats but keeps the person', () => {
    const r = parseParticipantsCsv('Dora;irgendwo;')
    expect(r.participants).toHaveLength(1)
    expect(r.errors[0]).toContain('Sitzplatz')
  })

  it('splits lines correctly', () => {
    expect(splitCsvLine('a;"b;c";d', ';')).toEqual(['a', 'b;c', 'd'])
  })
})

describe('Sitzplätze', () => {
  it('parses several notations', () => {
    expect(parseSeat('2/3')).toEqual({ row: 2, col: 3 })
    expect(parseSeat('R1 P4')).toEqual({ row: 1, col: 4 })
    expect(parseSeat('x')).toBeNull()
  })

  it('U-form only has outer cells', () => {
    const u = { kind: 'u' as const, rows: 3, cols: 4 }
    expect(isSeatCell(u, 1, 2)).toBe(false)
    expect(isSeatCell(u, 3, 2)).toBe(true)
    expect(seatsOf(u)).toHaveLength(3 + 3 + 2)
    expect(seatLabel(u, { row: 2, col: 1 })).toBe('links 2')
    expect(seatLabel(u, { row: 3, col: 2 })).toBe('hinten 1')
    expect(seatLabel(u, { row: 2, col: 4 })).toBe('rechts 2')
  })

  it('grid labels', () => {
    expect(seatLabel({ kind: 'grid', rows: 2, cols: 2 }, { row: 2, col: 1 })).toBe('Reihe 2, Platz 1')
    expect(seatLabel({ kind: 'grid', rows: 2, cols: 2 }, null)).toBe('kein Platz')
  })
})

describe('format', () => {
  it('mmss', () => {
    expect(mmss(134)).toBe('02:14')
    expect(mmss(0)).toBe('00:00')
    expect(mmss(3599.9)).toBe('59:59')
  })
})
