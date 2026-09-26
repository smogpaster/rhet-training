import { describe, expect, it } from 'vitest'
import { excerptAt, fillExcerpts } from './align'
import { pcmToWav } from '../wav'

const words = [
  { w: 'Guten', s: 0, e: 0.4 },
  { w: 'Morgen', s: 0.5, e: 0.9 },
  { w: 'zusammen', s: 1.0, e: 1.5 },
  { w: '.', s: 1.5, e: 1.5 },
  { w: 'Heute', s: 12, e: 12.4 },
  { w: 'geht', s: 12.5, e: 12.7 },
  { w: 'es', s: 12.8, e: 12.9 },
  { w: 'um', s: 13, e: 13.2 },
  { w: 'Stimme', s: 13.3, e: 13.9 },
  { w: 'später', s: 30, e: 30.5 },
]

describe('excerpt alignment', () => {
  it('takes words from 10 s before to 5 s after the marker', () => {
    expect(excerptAt(words, 14)).toBe('Heute geht es um Stimme')
    expect(excerptAt(words, 5)).toBe('Guten Morgen zusammen.')
    expect(excerptAt(words, 100)).toBe('')
  })
  it('fills marker excerpts', () => {
    const out = fillExcerpts([{ id: 'a', t: 14, kind: 'stark' }, { id: 'b', t: 100, kind: 'besprechen' }], words)
    expect(out[0].excerpt).toBe('Heute geht es um Stimme')
    expect(out[1].excerpt).toBeUndefined()
  })
})

describe('wav', () => {
  it('writes a valid header', async () => {
    const wav = pcmToWav([new Uint8Array(3200), new Uint8Array(3200)])
    expect(wav.size).toBe(44 + 6400)
    const head = new DataView(await wav.slice(0, 44).arrayBuffer())
    expect(String.fromCharCode(head.getUint8(0), head.getUint8(1), head.getUint8(2), head.getUint8(3))).toBe('RIFF')
    expect(head.getUint32(24, true)).toBe(16000)
    expect(head.getUint32(40, true)).toBe(6400)
  })
})
