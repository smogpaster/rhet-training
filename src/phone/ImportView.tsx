import { useEffect, useRef, useState } from 'preact/hooks'
import { mmss } from '../data/format'
import type { Workshop } from '../data/model'
import type { Store } from '../data/store'
import type { GlassesHost } from '../glasses/host'
import { applyIntroResult, layoutFor, normalizeKind, seatFor } from '../llm/applyIntro'
import { analyzeIntro } from '../llm/claude'
import type { IntroResult } from '../llm/introSchema'
import { seatLabel } from '../data/seats'
import { AudioRecorder } from '../session/recorder'
import { transcriber } from '../session/transcription/service'
import { toJpegBase64 } from './image'

interface Props {
  store: Store
  ws: Workshop | null
  host: GlassesHost
  goTo: (tab: 'people' | 'settings') => void
}

export function ImportView({ store, ws, host, goTo }: Props) {
  const settings = store.get().settings
  const [question, setQuestion] = useState(ws?.intro.question ?? '')
  const [transcript, setTranscript] = useState(ws?.intro.transcript ?? '')
  const [notes, setNotes] = useState('')
  const [photo, setPhoto] = useState<{ base64: string; dataUrl: string } | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<IntroResult | null>(null)
  const [recording, setRecording] = useState(false)
  const [recSec, setRecSec] = useState(0)
  const recorder = useRef<AudioRecorder | null>(null)

  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setRecSec(recorder.current?.durationSec ?? 0), 1000)
    return () => clearInterval(t)
  }, [recording])

  if (!ws) return <p class="dim">Bitte zuerst einen Workshop anlegen oder auswählen.</p>

  const hasClaude = settings.claudeApiKey.trim().length > 0
  const hasOpenAi = settings.openaiApiKey.trim().length > 0
  const run = async (label: string, fn: () => Promise<void>) => {
    setError('')
    setBusy(label)
    try {
      await fn()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy('')
    }
  }
  const saveIntroDraft = (patch: Partial<Workshop['intro']>) =>
    store.update(d => {
      const w = d.workshops.find(x => x.id === ws.id)
      if (w) Object.assign(w.intro, patch)
    })

  const onTxt = async (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0]
    if (!f) return
    const text = await f.text()
    setTranscript(text)
    saveIntroDraft({ transcript: text })
  }

  const onAudio = (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0]
    if (!f) return
    void run('Audiodatei wird transkribiert …', async () => {
      const text = await transcriber(store).transcribeText(f, f.name, 'de', setBusy)
      setTranscript(text)
      saveIntroDraft({ transcript: text })
    })
  }

  const toggleRecording = async () => {
    if (!recording) {
      const r = new AudioRecorder(host)
      const ok = await r.start()
      if (!ok) return setError('Mikrofon der Brille nicht verfügbar.')
      recorder.current = r
      setRecSec(0)
      setRecording(true)
      return
    }
    setRecording(false)
    const r = recorder.current
    recorder.current = null
    const wav = await r?.stop()
    r?.clear()
    if (!wav) return setError('Keine Audiodaten aufgenommen.')
    void run('Aufnahme wird transkribiert …', async () => {
      const text = await transcriber(store).transcribeText(wav, 'vorstellungsrunde.wav', 'de', setBusy)
      setTranscript(text)
      saveIntroDraft({ transcript: text })
    })
  }

  const loadPhoto = (src: Blob | string) => run('Foto wird vorbereitet …', async () => setPhoto(await toJpegBase64(src)))
  const pickFromHost = (kind: 'album' | 'camera') =>
    run('Foto wird geladen …', async () => {
      const asset = kind === 'album' ? await host.pickImageFromAlbum?.() : await host.captureImageFromCamera?.()
      if (asset) setPhoto(await toJpegBase64(`data:${asset.mimeType};base64,${asset.base64}`))
    })

  const analyze = () => {
    if (!transcript.trim()) return setError('Bitte zuerst ein Transkript eingeben, laden oder aufnehmen.')
    const msg =
      'Für die Auswertung werden Transkript' + (photo ? ', Sitzplan-Foto' : '') + ' und Notizen an die Claude-API von Anthropic gesendet (USA, Daten werden nicht zum Training genutzt). Fortfahren?'
    if (!confirm(msg)) return
    saveIntroDraft({ question, transcript })
    void run('Auswertung läuft …', async () => {
      const r = await analyzeIntro(
        settings.claudeApiKey,
        {
          workshopTitle: ws.title,
          question,
          transcript,
          planImageBase64: photo?.base64,
          trainerNotes: notes,
          knownNames: ws.participants.map(p => p.name),
          layoutHint: ws.layout.kind,
        },
        setBusy,
      )
      setResult(r)
    })
  }

  const apply = () => {
    if (!result) return
    if (ws.participants.length && !confirm(`Es gibt schon ${ws.participants.length} Personen. Gleiche Namen werden ergänzt, neue angelegt. Weiter?`)) return
    store.update(d => {
      const w = d.workshops.find(x => x.id === ws.id)
      if (!w) return
      applyIntroResult(w, result, question)
      if (!d.settings.keepIntroTranscript) w.intro.transcript = ''
    })
    setResult(null)
    setPhoto(null)
    if (!store.get().settings.keepIntroTranscript) setTranscript('')
    goTo('people')
  }

  return (
    <div>
      <h2>Vorstellungsrunde</h2>
      {(!hasClaude || !hasOpenAi) && (
        <div class="notice small">
          {!hasClaude && <div>Für die Auswertung fehlt dein Claude-API-Schlüssel.</div>}
          {!hasOpenAi && <div>Für Aufnahme und Audiodateien fehlt dein OpenAI-API-Schlüssel. Ein fertiges Transkript (.txt) geht auch ohne.</div>}
          <button class="btn small" style={{ marginTop: 6 }} onClick={() => goTo('settings')}>
            Schlüssel eintragen
          </button>
        </div>
      )}

      <div class="card">
        <label class="field">
          <span>Einstiegsfrage</span>
          <input value={question} onInput={e => setQuestion((e.target as HTMLInputElement).value)} onBlur={() => saveIntroDraft({ question })} placeholder="z. B. Was ist Ihr bester Türöffner bei Neukunden?" />
        </label>
      </div>

      <h3>1. Transkript</h3>
      <div class="card">
        <div class="row wrap">
          <button class={`btn ${recording ? 'danger' : ''}`} disabled={!hasOpenAi || !!busy} onClick={toggleRecording}>
            {recording ? `■ Aufnahme beenden (${mmss(recSec)})` : '● Mit Brillenmikrofon aufnehmen'}
          </button>
        </div>
        <div class="row wrap" style={{ marginTop: 8 }}>
          <label class="btn small">
            Textdatei (.txt)
            <input type="file" accept=".txt,text/plain" onChange={onTxt} style={{ display: 'none' }} />
          </label>
          <label class={`btn small ${hasOpenAi ? '' : 'disabled'}`}>
            Audiodatei
            <input type="file" accept="audio/*,.m4a,.mp3,.wav" disabled={!hasOpenAi} onChange={onAudio} style={{ display: 'none' }} />
          </label>
        </div>
        <textarea
          class="small"
          rows={8}
          value={transcript}
          onInput={e => setTranscript((e.target as HTMLTextAreaElement).value)}
          onBlur={() => saveIntroDraft({ transcript })}
          placeholder="Transkript hier einfügen oder oben laden"
          style={{ marginTop: 8 }}
        />
        <p class="small dim">{transcript ? `${transcript.length} Zeichen` : 'Noch kein Transkript.'}</p>
      </div>

      <h3>2. Sitzplan-Foto (optional)</h3>
      <div class="card">
        <div class="row wrap">
          {host.pickImageFromAlbum && (
            <button class="btn small" onClick={() => pickFromHost('album')}>
              Aus Fotos
            </button>
          )}
          {host.captureImageFromCamera && (
            <button class="btn small" onClick={() => pickFromHost('camera')}>
              Foto aufnehmen
            </button>
          )}
          <label class="btn small">
            Bilddatei
            <input type="file" accept="image/*" onChange={e => {
              const f = (e.target as HTMLInputElement).files?.[0]
              if (f) void loadPhoto(f)
            }} style={{ display: 'none' }} />
          </label>
          {photo && (
            <button class="btn small danger" onClick={() => setPhoto(null)}>
              Foto entfernen
            </button>
          )}
        </div>
        {photo && <img src={photo.dataUrl} alt="Sitzplan" style={{ width: '100%', marginTop: 8, borderRadius: 8 }} />}
        <label class="field" style={{ marginTop: 8 }}>
          <span>Stichworte aus der Runde (optional)</span>
          <textarea class="small" rows={3} value={notes} onInput={e => setNotes((e.target as HTMLTextAreaElement).value)} placeholder="z. B. Tafel: offene Fragen, Zuhören …" />
        </label>
      </div>

      <h3>3. Auswerten</h3>
      <div class="card">
        <button class="btn primary" disabled={!hasClaude || !!busy || !transcript.trim()} onClick={analyze}>
          Mit Claude auswerten
        </button>
        {busy && <p class="small">{busy}</p>}
        {error && <p class="err">{error}</p>}
      </div>

      {result && <ResultPreview result={result} ws={ws} onApply={apply} onDiscard={() => setResult(null)} />}
    </div>
  )
}

function ResultPreview({ result, ws, onApply, onDiscard }: { result: IntroResult; ws: Workshop; onApply: () => void; onDiscard: () => void }) {
  const layout = layoutFor(normalizeKind(result.layoutKind), result.people.flatMap(p => (p.seat ? [p.seat] : [])), ws.layout)
  const people = [...result.people].sort((a, b) => a.introOrder - b.introOrder)
  const checks = people.filter(p => p.nameCheck || p.seatCheck || !p.seat).length + result.planOnlyNames.length
  return (
    <div class="card">
      <h3 style={{ marginTop: 0 }}>Ergebnis</h3>
      <p class="small">
        {people.length} Personen · {checks} Hinweis{checks === 1 ? '' : 'e'} zum Prüfen · {result.layoutNote}
      </p>
      <ul class="list">
        {people.map((p, i) => {
          const seat = p.seat ? seatFor(layout, p.seat) : null
          return (
            <li key={i}>
              <div>
                {p.introOrder}. <strong>{p.name}</strong> <span class="dim small">{p.group}</span>
                {(p.nameCheck || p.seatCheck || !seat) && <span class="badge warn" style={{ marginLeft: 6 }}>prüfen</span>}
              </div>
              <div class="small dim">
                {[p.role, seatLabel(layout, seat), p.board ? `Tafel: ${p.board}` : ''].filter(Boolean).join(' · ')}
              </div>
              {p.nameCheck && <div class="small">Name: {p.nameCheck}</div>}
              {p.seatCheck && <div class="small">Platz: {p.seatCheck}</div>}
            </li>
          )
        })}
        {result.planOnlyNames.map(n => (
          <li key={n}>
            <strong>{n}</strong> <span class="badge warn">nur auf dem Plan</span>
          </li>
        ))}
      </ul>
      {result.overview && <p class="small">{result.overview}</p>}
      <div class="row wrap">
        <button class="btn primary" onClick={onApply}>
          Übernehmen
        </button>
        <button class="btn" onClick={onDiscard}>
          Verwerfen
        </button>
      </div>
      <p class="small dim">Nach dem Übernehmen kannst du unter „Personen“ alles korrigieren. Offene Hinweise stehen dort oben.</p>
    </div>
  )
}
