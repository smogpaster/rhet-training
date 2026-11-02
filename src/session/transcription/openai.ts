// Spracherkennung über die OpenAI-API (Bring your own key).
// Modell whisper-1, weil es Wort-Zeitstempel liefert (nötig für Marker-Ausschnitte).
// Dateigrenze der API: 25 MB. WAV mit 16 kHz mono braucht ~1,9 MB pro Minute,
// deshalb werden längere Aufnahmen in 10-Minuten-Stücke geteilt.
import type { TranscriptWord } from '../../data/model'
import { BYTES_PER_SECOND, pcmToWav } from '../wav'
import type { TranscriptionProvider } from './provider'

export const OPENAI_TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions'
const SEGMENT_SEC = 600
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

interface VerboseJson {
  text: string
  words?: Array<{ word: string; start: number; end: number }>
  segments?: Array<{ text: string; start: number; end: number }>
}

export class OpenAiTranscriber implements TranscriptionProvider {
  readonly id = 'openai'
  readonly label = 'OpenAI Whisper'

  constructor(private apiKey: () => string, private fetchImpl: typeof fetch = (...a) => fetch(...a)) {}

  isConfigured(): boolean {
    return this.apiKey().trim().length > 0
  }

  /** Eine Datei (≤ 25 MB) transkribieren. */
  private async transcribeFile(file: Blob, fileName: string, language: string): Promise<VerboseJson> {
    const form = new FormData()
    form.append('file', file, fileName)
    form.append('model', 'whisper-1')
    form.append('language', language)
    form.append('response_format', 'verbose_json')
    form.append('timestamp_granularities[]', 'word')
    form.append('timestamp_granularities[]', 'segment')
    const res = await this.fetchImpl(OPENAI_TRANSCRIBE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey().trim()}` },
      body: form,
    })
    if (!res.ok) {
      let detail = ''
      try {
        detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? ''
      } catch {
        /* keine JSON-Antwort */
      }
      if (res.status === 401) throw new Error('OpenAI-Schlüssel ungültig (401).')
      if (res.status === 429) throw new Error('OpenAI: Limit erreicht oder kein Guthaben (429).')
      throw new Error(`OpenAI-Fehler ${res.status}${detail ? `: ${detail}` : ''}`)
    }
    return (await res.json()) as VerboseJson
  }

  /** WAV der App (16 kHz mono) transkribieren, mit Wort-Zeitstempeln über alle Stücke. */
  async transcribe(wav: Blob, language: string, onProgress?: (text: string) => void): Promise<TranscriptWord[]> {
    const segments = await splitWav(wav, SEGMENT_SEC)
    const words: TranscriptWord[] = []
    for (let i = 0; i < segments.length; i++) {
      onProgress?.(`Transkribiere Teil ${i + 1} von ${segments.length} …`)
      const offset = i * SEGMENT_SEC
      const r = await this.transcribeFile(segments[i], `teil-${i + 1}.wav`, language)
      if (r.words?.length) for (const w of r.words) words.push({ w: w.word.trim(), s: w.start + offset, e: w.end + offset })
      else if (r.text.trim()) words.push(...r.text.trim().split(/\s+/).map(w => ({ w, s: offset, e: offset })))
    }
    return words
  }

  /** Beliebige Audiodatei (m4a, mp3, wav …) als Fließtext transkribieren, z. B. die Vorstellungsrunde. */
  async transcribeText(file: Blob, fileName: string, language: string, onProgress?: (text: string) => void): Promise<string> {
    if (file.type === 'audio/wav' || fileName.endsWith('.wav')) {
      const words = await this.transcribe(file, language, onProgress)
      return wordsToText(words)
    }
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('Datei größer als 25 MB. Bitte kürzen oder direkt in der App aufnehmen.')
    onProgress?.('Transkribiere …')
    const r = await this.transcribeFile(file, fileName, language)
    return r.segments?.length ? r.segments.map(s => s.text.trim()).join('\n') : r.text
  }
}

/** Zerlegt eine 16-kHz-Mono-WAV in Stücke von maximal `seconds` Sekunden. */
export async function splitWav(wav: Blob, seconds: number): Promise<Blob[]> {
  const buf = new Uint8Array(await wav.arrayBuffer())
  const pcm = buf.subarray(44)
  const size = seconds * BYTES_PER_SECOND
  if (pcm.byteLength <= size) return [wav]
  const out: Blob[] = []
  for (let i = 0; i < pcm.byteLength; i += size) out.push(pcmToWav([pcm.slice(i, i + size)]))
  return out
}

/** Wörter zu lesbarem Text; neue Zeile bei Sprechpausen über 1,5 s. */
export function wordsToText(words: TranscriptWord[]): string {
  let out = ''
  let prevEnd = 0
  for (const w of words) {
    if (out && w.s - prevEnd > 1.5) out += '\n'
    else if (out) out += ' '
    out += w.w
    prevEnd = w.e
  }
  return out.replace(/ ([.,;:!?])/g, '$1')
}
