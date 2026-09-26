// Session-Logik als reine Funktionen auf dem Store, damit Brille und iPhone
// denselben Zustand sehen und ein App-Neustart nichts verliert.
import { newId, type Marker, type MarkerKind, type Session, type TranscriptWord, type Workshop } from '../data/model'
import { fillExcerpts } from './transcription/align'
import type { Store } from '../data/store'

/** Abgelaufene Redezeit in Sekunden (Pausen abgezogen). */
export function elapsedSec(s: Session, now = Date.now()): number {
  if (s.status === 'ended') return s.durationSec
  const started = new Date(s.startedAt).getTime()
  const pausedNow = s.pausedAt ? now - new Date(s.pausedAt).getTime() : 0
  return Math.max(0, (now - started - s.pausedSec * 1000 - pausedNow) / 1000)
}

export function runningSession(ws: Workshop | null): Session | null {
  return ws?.sessions.find(s => s.status === 'running') ?? null
}

export function startSession(store: Store, workshopId: string, participantId: string, now = Date.now()): Session {
  const session: Session = {
    id: newId(),
    workshopId,
    participantId,
    startedAt: new Date(now).toISOString(),
    durationSec: 0,
    status: 'running',
    pausedSec: 0,
    pausedAt: null,
    markers: [],
    audioDeleted: false,
  }
  store.update(d => {
    const ws = d.workshops.find(w => w.id === workshopId)
    if (!ws) return
    // Es läuft immer nur eine Session: alte "running"-Reste sauber beenden.
    for (const s of ws.sessions) if (s.status === 'running') finish(s, now)
    ws.sessions.push(session)
  })
  return session
}

function edit(store: Store, sessionId: string, fn: (s: Session) => void) {
  store.update(d => {
    for (const ws of d.workshops) {
      const s = ws.sessions.find(x => x.id === sessionId)
      if (s) return fn(s)
    }
  })
}

export function addMarker(store: Store, sessionId: string, kind: MarkerKind, now = Date.now()): Marker | null {
  let marker: Marker | null = null
  edit(store, sessionId, s => {
    if (s.status !== 'running' || s.pausedAt) return
    marker = { id: newId(), t: Math.round(elapsedSec(s, now)), kind }
    s.markers.push(marker)
  })
  return marker
}

export function removeMarker(store: Store, sessionId: string, markerId: string) {
  edit(store, sessionId, s => void (s.markers = s.markers.filter(m => m.id !== markerId)))
}

/** Pause ein-/ausschalten. Liefert den neuen Pausenzustand. */
export function togglePause(store: Store, sessionId: string, now = Date.now()): boolean {
  let paused = false
  edit(store, sessionId, s => {
    if (s.status !== 'running') return
    if (s.pausedAt) {
      s.pausedSec += (now - new Date(s.pausedAt).getTime()) / 1000
      s.pausedAt = null
    } else s.pausedAt = new Date(now).toISOString()
    paused = !!s.pausedAt
  })
  return paused
}

function finish(s: Session, now: number) {
  s.durationSec = Math.round(elapsedSec(s, now))
  s.pausedAt = null
  s.status = 'ended'
}

export function endSession(store: Store, sessionId: string, now = Date.now()) {
  edit(store, sessionId, s => {
    if (s.status === 'running') finish(s, now)
  })
}

export function setSessionAudio(store: Store, sessionId: string, hasAudio: boolean) {
  edit(store, sessionId, s => {
    s.hasAudio = hasAudio
    if (!hasAudio) s.audioDeleted = true
  })
}

/** Transkript übernehmen und die Marker-Ausschnitte (−10 s / +5 s) füllen. */
export function setTranscript(store: Store, sessionId: string, words: TranscriptWord[]) {
  edit(store, sessionId, s => {
    s.transcript = words
    s.markers = fillExcerpts(s.markers, words)
  })
}

export function deleteSession(store: Store, sessionId: string) {
  store.update(d => {
    for (const ws of d.workshops) ws.sessions = ws.sessions.filter(s => s.id !== sessionId)
  })
}

export function findSession(ws: Workshop | null, sessionId: string): Session | null {
  return ws?.sessions.find(s => s.id === sessionId) ?? null
}
