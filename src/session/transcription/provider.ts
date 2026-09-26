import type { TranscriptWord } from '../../data/model'

/**
 * Austauschbare Schnittstelle zu einem Transkriptionsdienst.
 * Eingabe: WAV (16 kHz, mono). Ausgabe: Wörter mit Zeitstempeln in Sekunden.
 */
export interface TranscriptionProvider {
  readonly id: string
  readonly label: string
  /** Ob ein Schlüssel o. Ä. konfiguriert ist. */
  isConfigured(): boolean
  transcribe(wav: Blob, language: string, onProgress?: (text: string) => void): Promise<TranscriptWord[]>
}

/** Platzhalter, bis ein Dienst gewählt ist. */
export class NoProvider implements TranscriptionProvider {
  readonly id = 'none'
  readonly label = 'Kein Dienst gewählt'
  isConfigured() {
    return false
  }
  async transcribe(): Promise<TranscriptWord[]> {
    throw new Error('Es ist noch kein Transkriptionsdienst eingerichtet.')
  }
}
