import { describe, expect, it } from 'vitest'
import { pcmToWav, BYTES_PER_SECOND } from '../wav'
import { OpenAiTranscriber, splitWav, wordsToText } from './openai'

describe('OpenAI transcriber', () => {
  it('splits long recordings and offsets word timestamps', async () => {
    const wav = pcmToWav([new Uint8Array(BYTES_PER_SECOND * 25)]) // 25 s
    expect((await splitWav(wav, 10)).length).toBe(3)

    const calls: FormData[] = []
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      calls.push(init.body as FormData)
      return new Response(JSON.stringify({ text: 'Hallo zusammen', words: [{ word: 'Hallo', start: 1, end: 1.4 }, { word: 'zusammen', start: 1.5, end: 2 }] }), { status: 200 })
    }) as unknown as typeof fetch
    // Segmentlänge 600 s → 25 s bleiben ein Stück
    const t = new OpenAiTranscriber(() => 'sk-test', fakeFetch)
    const words = await t.transcribe(wav, 'de')
    expect(calls).toHaveLength(1)
    expect(calls[0].get('model')).toBe('whisper-1')
    expect(calls[0].get('language')).toBe('de')
    expect(words).toEqual([{ w: 'Hallo', s: 1, e: 1.4 }, { w: 'zusammen', s: 1.5, e: 2 }])
  })

  it('reports an invalid key clearly', async () => {
    const fakeFetch = (async () => new Response('{}', { status: 401 })) as unknown as typeof fetch
    const t = new OpenAiTranscriber(() => 'x', fakeFetch)
    await expect(t.transcribe(pcmToWav([new Uint8Array(3200)]), 'de')).rejects.toThrow('ungültig')
  })

  it('joins words to text with line breaks at pauses', () => {
    expect(wordsToText([{ w: 'Ich', s: 0, e: 0.2 }, { w: 'bin', s: 0.3, e: 0.5 }, { w: '.', s: 0.5, e: 0.5 }, { w: 'Weiter', s: 3, e: 3.3 }])).toBe('Ich bin.\nWeiter')
  })
})
