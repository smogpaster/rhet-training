import { mmss } from '../../data/format'
import { audioStore } from '../../session/audioStore'
import { addPersonNote, noteAudioKey } from '../../session/notes'
import { AudioRecorder } from '../../session/recorder'
import { transcribeNote } from '../../session/transcription/service'
import type { GlassesInput } from '../input'
import type { PageSpec } from '../page'
import type { Nav, Screen } from '../nav'
import { DIM, NORMAL } from './common'

const BODY = { id: 1, name: 'voice' }
const MAX_SEC = 120

/** Sprachnotiz zu einer Person: Aufnahme über das Brillenmikrofon, Tipp = fertig, Doppeltipp = verwerfen. */
export class VoiceNoteScreen implements Screen {
  selfUpdating = true
  blocksQuickAccess = true
  private recorder: AudioRecorder
  private ticker: ReturnType<typeof setInterval> | null = null
  private done = false

  constructor(private nav: Nav, private participantId: string) {
    this.recorder = new AudioRecorder(nav.host)
    void this.recorder.start().then(ok => {
      if (!ok) this.nav.updateText(BODY.id, BODY.name, 'Mikrofon nicht verfügbar\n●● zurück', NORMAL)
    })
    this.ticker = setInterval(() => {
      if (this.recorder.durationSec >= MAX_SEC) return void this.finish(true)
      this.nav.updateText(BODY.id, BODY.name, this.text())
    }, 1000)
  }

  private name(): string {
    return this.nav.store.activeWorkshop()?.participants.find(p => p.id === this.participantId)?.name ?? ''
  }

  private text(): string {
    return `● Sprachnotiz: ${this.name()}\n${mmss(this.recorder.durationSec)}`
  }

  page(): PageSpec {
    return {
      texts: [
        { ...BODY, content: this.text(), x: 0, y: 0, w: 576, h: 200, textColor: NORMAL, padding: 8, capture: true },
        { id: 2, name: 'hint', content: '● fertig   ●● verwerfen', x: 0, y: 248, w: 576, h: 40, textColor: DIM, padding: 6 },
      ],
    }
  }

  private async finish(keep: boolean) {
    if (this.done) return
    this.done = true
    if (this.ticker) clearInterval(this.ticker)
    const wav = await this.recorder.stop()
    this.recorder.clear()
    const ws = this.nav.store.activeWorkshop()
    if (keep && wav && ws) {
      const note = addPersonNote(this.nav.store, ws.id, this.participantId, 'notiz', { hasAudio: true, text: '' })
      const saved = await audioStore.save(noteAudioKey(note.id), wav)
      if (saved) void transcribeNote(this.nav.store, ws.id, note.id)
    }
    this.nav.pop()
  }

  onInput(input: GlassesInput) {
    if (input.kind === 'tap') void this.finish(true)
    else if (input.kind === 'double') void this.finish(false)
  }

  onLeave() {
    if (this.ticker) clearInterval(this.ticker)
    if (!this.done && this.recorder.active) {
      // Unerwartetes Verlassen: Aufnahme behalten
      void this.finish(true)
    }
  }
}
