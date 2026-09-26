// Sammelt die PCM-Pakete der Brille während einer Session. Während einer Pause
// werden keine Pakete übernommen, damit die Audiozeit der Redezeit entspricht
// und Marker-Zeitstempel direkt auf das Transkript passen.
import { AudioInputSource, type EvenHubEvent } from '@evenrealities/even_hub_sdk'
import type { GlassesHost } from '../glasses/host'
import { pcmDurationSec, pcmToWav } from './wav'

export class AudioRecorder {
  private chunks: Uint8Array[] = []
  private bytes = 0
  private unsubscribe: (() => void) | null = null
  paused = false
  active = false

  constructor(private host: GlassesHost) {}

  async start(source: AudioInputSource = AudioInputSource.Glasses): Promise<boolean> {
    if (this.active) return true
    this.unsubscribe = this.host.onEvenHubEvent(e => this.onEvent(e))
    const ok = await this.host.audioControl(true, source).catch(() => false)
    this.active = ok
    if (!ok) {
      this.unsubscribe?.()
      this.unsubscribe = null
    }
    return ok
  }

  private onEvent(e: EvenHubEvent) {
    const pcm = e.audioEvent?.audioPcm
    if (!pcm || !this.active || this.paused) return
    // Kopie, falls der Host den Puffer wiederverwendet.
    const copy = new Uint8Array(pcm)
    this.chunks.push(copy)
    this.bytes += copy.byteLength
  }

  get durationSec(): number {
    return pcmDurationSec(this.bytes)
  }

  get byteLength(): number {
    return this.bytes
  }

  async stop(): Promise<Blob | null> {
    if (this.active) await this.host.audioControl(false).catch(() => undefined)
    this.active = false
    this.unsubscribe?.()
    this.unsubscribe = null
    if (this.bytes === 0) return null
    return pcmToWav(this.chunks)
  }

  /** Puffer freigeben (nach dem Speichern oder bei Verwerfen). */
  clear() {
    this.chunks = []
    this.bytes = 0
  }
}
