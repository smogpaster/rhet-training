import { describe, expect, it } from 'vitest'
import { newParticipant, newWorkshop } from '../data/model'
import { applyIntroResult, layoutFor, normalizeName, seatFor } from './applyIntro'
import type { IntroPerson, IntroResult } from './introSchema'

const person = (over: Partial<IntroPerson>): IntroPerson => ({
  name: 'X',
  nameTranscript: '',
  namePlan: '',
  nameCheck: '',
  nameOptions: [],
  introOrder: 1,
  seat: null,
  seatCheck: '',
  group: '',
  role: '',
  experience: '',
  area: '',
  background: '',
  answer: '',
  board: '',
  tip: '',
  evidence: '',
  ...over,
})

const result = (people: IntroPerson[], extra: Partial<IntroResult> = {}): IntroResult => ({
  layoutKind: 'u',
  layoutNote: '',
  groups: [],
  people,
  planOnlyNames: [],
  overview: 'Gute Mischung.',
  expectations: ['Einwände'],
  ...extra,
})

describe('applyIntroResult', () => {
  it('maps a U-form to rows/cols and seats', () => {
    const l = layoutFor('u', [{ area: 'links', group: 1, position: 4 }, { area: 'stirnseite', group: 1, position: 4 }, { area: 'rechts', group: 1, position: 3 }], { kind: 'grid', rows: 1, cols: 1 })
    expect(l).toEqual({ kind: 'u', rows: 5, cols: 6 })
    expect(seatFor(l, { area: 'stirnseite', group: 1, position: 1 })).toEqual({ row: 5, col: 2 })
    expect(seatFor(l, { area: 'rechts', group: 1, position: 2 })).toEqual({ row: 2, col: 6 })
  })

  it('creates people with profiles, groups and keeps name variants as checks', () => {
    const ws = newWorkshop('W')
    const r = result(
      [
        person({ name: 'Udo Peters', nameTranscript: 'Uwe Peters', namePlan: 'Udo', nameCheck: 'Transkript „Uwe“, Plan „Udo“', nameOptions: ['Uwe Peters'], introOrder: 2, seat: { area: 'links', group: 1, position: 3 }, group: 'Außendienst', role: 'Außendienst Nord', board: 'authentisch' }),
        person({ name: 'Sarah Albrecht', introOrder: 1, seat: { area: 'rechts', group: 1, position: 3 }, group: 'Innendienst' }),
      ],
      { groups: ['Außendienst', 'Innendienst'] },
    )
    const s = applyIntroResult(ws, r, 'Bester Türöffner?')
    expect(s).toEqual({ created: 2, updated: 0, checks: 1 })
    const udo = ws.participants.find(p => p.name === 'Udo Peters')!
    expect(udo.nameOptions).toEqual(['Udo Peters', 'Uwe Peters'])
    expect(udo.seat).toEqual({ row: 3, col: 1 })
    expect(udo.profile?.board).toBe('authentisch')
    expect(ws.groups.map(g => g.label)).toEqual(['Außendienst', 'Innendienst'])
    expect(udo.groupId).toBe(ws.groups[0].id)
    expect(ws.intro.question).toBe('Bester Türöffner?')
    expect(ws.intro.expectations).toEqual(['Einwände'])
  })

  it('updates existing people found by any spelling and keeps own notes', () => {
    const ws = newWorkshop('W')
    ws.participants.push({ ...newParticipant('Uwe Peters', 'eigene Notiz'), shortName: 'Uwe' })
    applyIntroResult(ws, result([person({ name: 'Udo Peters', nameTranscript: 'Uwe Peters', seat: { area: 'links', group: 1, position: 1 } })]), '')
    expect(ws.participants).toHaveLength(1)
    expect(ws.participants[0].name).toBe('Udo Peters')
    expect(ws.participants[0].note).toBe('eigene Notiz')
    expect(ws.participants[0].shortName).toBe('Uwe')
  })

  it('flags double seats, missing seats and plan-only names', () => {
    const ws = newWorkshop('W')
    const seat = { area: 'links' as const, group: 1, position: 1 }
    const s = applyIntroResult(ws, result([person({ name: 'A', introOrder: 1, seat }), person({ name: 'B', introOrder: 2, seat }), person({ name: 'C', introOrder: 3 })], { planOnlyNames: ['D'] }), '')
    const by = (n: string) => ws.participants.find(p => p.name === n)!
    expect(by('A').seat).toEqual({ row: 1, col: 1 })
    expect(by('B').seat).toBeNull()
    expect(by('B').seatCheck).toContain('doppelt')
    expect(by('C').seatCheck).toContain('Kein Platz')
    expect(by('D').nameCheck).toContain('nicht im Transkript')
    expect(s.checks).toBe(3)
  })

  it('normalizes names for matching', () => {
    expect(normalizeName('Jürgen  Schüren')).toBe('juergen schueren')
    expect(normalizeName('Deniz Aydın')).toBe('deniz aydin')
    expect(normalizeName('Göttlicher')).toBe(normalizeName('Goettlicher'))
  })
})
