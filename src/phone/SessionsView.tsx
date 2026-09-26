import { useEffect, useState } from 'preact/hooks'
import { formatDateTime, mmss } from '../data/format'
import { MARKER_LABEL, type Session, type Workshop } from '../data/model'
import type { Store } from '../data/store'
import { exportFileName, sessionToMarkdown } from '../export/markdown'
import { audioStore } from '../session/audioStore'
import { deleteSession, elapsedSec, endSession, setSessionAudio } from '../session/session'

function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])
  return now
}

/** Markdown teilen: Teilen-Dialog mit Datei, sonst Text, sonst Zwischenablage. */
async function shareMarkdown(md: string, fileName: string): Promise<string> {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void>; canShare?: (d: ShareData) => boolean }
  try {
    if (nav.share) {
      const file = new File([md], fileName, { type: 'text/markdown' })
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: fileName })
        return 'Geteilt.'
      }
      await nav.share({ title: fileName, text: md })
      return 'Geteilt.'
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return ''
  }
  try {
    await navigator.clipboard.writeText(md)
    return 'Kein Teilen-Dialog verfügbar, Markdown in die Zwischenablage kopiert.'
  } catch {
    return 'Teilen nicht möglich. Text unten markieren und kopieren.'
  }
}

export function SessionsView({ store, ws }: { store: Store; ws: Workshop | null }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [showMd, setShowMd] = useState(false)
  const running = ws?.sessions.find(s => s.status === 'running') ?? null
  const now = useNow(!!running)

  if (!ws) return <p class="dim">Bitte zuerst einen Workshop anlegen oder auswählen.</p>

  const nameOf = (s: Session) => ws.participants.find(p => p.id === s.participantId)?.name ?? 'Unbekannt'
  const setConsent = (v: boolean) =>
    store.update(d => {
      const w = d.workshops.find(x => x.id === ws.id)
      if (w) w.consentConfirmed = v
    })

  const open = openId ? ws.sessions.find(s => s.id === openId) ?? null : null
  if (open) {
    const participant = ws.participants.find(p => p.id === open.participantId) ?? null
    const md = sessionToMarkdown(ws, open, participant)
    return (
      <div>
        <button class="btn small" onClick={() => { setOpenId(null); setMessage(''); setShowMd(false) }}>
          ← Sessions
        </button>
        <h2>{nameOf(open)}</h2>
        <p class="dim small">
          {formatDateTime(open.startedAt)} · Redezeit {mmss(open.status === 'running' ? elapsedSec(open, now) : open.durationSec)}
          {open.status === 'running' ? ' · läuft' : ''}
        </p>
        {open.status === 'running' && (
          <button class="btn" onClick={() => endSession(store, open.id)}>
            Session beenden
          </button>
        )}
        <h3>Marker ({open.markers.length})</h3>
        {open.markers.length === 0 && <p class="dim">Keine Marker gesetzt.</p>}
        <ul class="list">
          {open.markers.map(m => (
            <li key={m.id}>
              <div>
                <strong>{mmss(m.t)}</strong> · {MARKER_LABEL[m.kind]}
              </div>
              <div class="small dim">{m.excerpt ?? 'Transkript-Ausschnitt folgt nach der Transkription (Meilenstein 4).'}</div>
            </li>
          ))}
        </ul>
        {open.status === 'ended' && (
          <div class="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Aufnahme und Transkript</h3>
            {open.transcript ? (
              <p class="small">Transkript vorhanden ({open.transcript.length} Wörter).</p>
            ) : open.hasAudio ? (
              <div>
                <p class="small">Aufnahme gespeichert, noch nicht transkribiert.</p>
                <div class="row wrap">
                  <button class="btn" disabled title="Kommt in Meilenstein 4">
                    Transkribieren (Dienst noch nicht gewählt)
                  </button>
                  <button
                    class="btn danger small"
                    onClick={async () => {
                      if (!confirm('Aufnahme dieser Session endgültig löschen?')) return
                      await audioStore.remove(open.id)
                      setSessionAudio(store, open.id, false)
                    }}
                  >
                    Aufnahme löschen
                  </button>
                </div>
              </div>
            ) : (
              <p class="small dim">{open.audioDeleted ? 'Aufnahme gelöscht.' : 'Keine Aufnahme (Mikrofon war nicht verfügbar).'}</p>
            )}
            <h3>Export</h3>
            <div class="row wrap">
              <button class="btn primary" onClick={async () => setMessage(await shareMarkdown(md, exportFileName(participant, open)))}>
                Als Markdown teilen
              </button>
              <button class="btn" onClick={() => setShowMd(v => !v)}>
                {showMd ? 'Text ausblenden' : 'Text anzeigen'}
              </button>
              <button
                class="btn danger"
                onClick={() => {
                  if (confirm('Diese Session mit allen Markern und der Aufnahme löschen?')) {
                    void audioStore.remove(open.id)
                    deleteSession(store, open.id)
                    setOpenId(null)
                  }
                }}
              >
                Löschen
              </button>
            </div>
            {message && <p class="small">{message}</p>}
            {showMd && <textarea rows={14} readOnly value={md} style={{ marginTop: 8, fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />}
          </div>
        )}
      </div>
    )
  }

  const sorted = [...ws.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  return (
    <div>
      <h2>Sessions</h2>
      <div class="notice">
        <label class="row">
          <input type="checkbox" style={{ width: 'auto' }} checked={ws.consentConfirmed} onChange={e => setConsent((e.target as HTMLInputElement).checked)} />
          <span>Die Einwilligung aller Teilnehmenden zu Aufnahme und Auswertung liegt vor (DSGVO). Ohne Häkchen lässt sich auf der Brille keine Session starten.</span>
        </label>
      </div>
      {running && (
        <div class="card">
          <div class="row between">
            <div>
              <div>
                <span class="small" style={{ color: 'var(--ok)' }}>● läuft</span> {nameOf(running)}
              </div>
              <div class="small dim">
                {mmss(elapsedSec(running, now))}
                {running.pausedAt ? ' · Pause' : ''} · {running.markers.length} Marker
              </div>
            </div>
            <button class="btn small" onClick={() => setOpenId(running.id)}>
              öffnen
            </button>
          </div>
        </div>
      )}
      <p class="small dim">Session starten: auf der Brille „Session starten“ wählen, Person antippen. Einfachtipp = stark, Doppeltipp = besprechen.</p>
      {sorted.length === 0 && <p class="dim">Noch keine Session.</p>}
      <ul class="list">
        {sorted
          .filter(s => s.status === 'ended')
          .map(s => (
            <li key={s.id} onClick={() => setOpenId(s.id)}>
              <div class="row between">
                <div class="grow">
                  <div>{nameOf(s)}</div>
                  <div class="small dim">
                    {formatDateTime(s.startedAt)} · {mmss(s.durationSec)} · {s.markers.length} Marker
                  </div>
                </div>
                <span class="dim">›</span>
              </div>
            </li>
          ))}
      </ul>
    </div>
  )
}
