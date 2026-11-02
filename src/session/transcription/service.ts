// Zentrale Stelle für Transkriptionen: Sessions und Sprachnotizen.
import type { Store } from '../../data/store'
import { audioStore } from '../audioStore'
import { noteAudioKey, updatePersonNote } from '../notes'
import { setSessionAudio, setTranscript } from '../session'
import { OpenAiTranscriber, wordsToText } from './openai'

export function transcriber(store: Store): OpenAiTranscriber {
  return new OpenAiTranscriber(() => store.get().settings.openaiApiKey)
}

/** Session-Aufnahme transkribieren, Marker-Ausschnitte füllen, ggf. Audio löschen. */
export async function transcribeSession(store: Store, sessionId: string, onProgress?: (t: string) => void): Promise<void> {
  const wav = await audioStore.load(sessionId)
  if (!wav) throw new Error('Keine Aufnahme gefunden.')
  const words = await transcriber(store).transcribe(wav, 'de', onProgress)
  setTranscript(store, sessionId, words)
  if (store.get().settings.autoDeleteAudio) {
    await audioStore.remove(sessionId)
    setSessionAudio(store, sessionId, false)
  }
}

/** Sprachnotiz transkribieren und als Text an die Notiz hängen. */
export async function transcribeNote(store: Store, workshopId: string, noteId: string): Promise<void> {
  const t = transcriber(store)
  if (!t.isConfigured()) return
  const wav = await audioStore.load(noteAudioKey(noteId))
  if (!wav) return
  updatePersonNote(store, workshopId, noteId, { transcription: 'pending' })
  try {
    const words = await t.transcribe(wav, 'de')
    updatePersonNote(store, workshopId, noteId, { text: wordsToText(words) || '(nichts verstanden)', transcription: 'done' })
    if (store.get().settings.autoDeleteAudio) {
      await audioStore.remove(noteAudioKey(noteId))
      updatePersonNote(store, workshopId, noteId, { hasAudio: false })
    }
  } catch (err) {
    console.warn('Sprachnotiz nicht transkribiert', err)
    updatePersonNote(store, workshopId, noteId, { transcription: 'failed' })
  }
}
