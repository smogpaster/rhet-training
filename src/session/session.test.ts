import { describe, expect, it } from 'vitest'
import { newParticipant, newWorkshop } from '../data/model'
import { MemoryStore } from '../data/storage'
import { Store } from '../data/store'
import { addMarker, elapsedSec, endSession, findSession, startSession, togglePause } from './session'

async function setup() {
  const store = new Store(new MemoryStore())
  await store.load()
  const ws = newWorkshop('WS')
  const p = newParticipant('Anna')
  ws.participants.push(p)
  store.update(d => {
    d.workshops.push(ws)
    d.activeWorkshopId = ws.id
  })
  return { store, ws, p }
}

describe('session', () => {
  it('counts speaking time without pauses and records markers', async () => {
    const { store, ws, p } = await setup()
    const t0 = 1_000_000
    const s = startSession(store, ws.id, p.id, t0)
    addMarker(store, s.id, 'stark', t0 + 134_400)
    expect(togglePause(store, s.id, t0 + 200_000)).toBe(true)
    expect(addMarker(store, s.id, 'besprechen', t0 + 210_000)).toBeNull() // während Pause ignoriert
    expect(togglePause(store, s.id, t0 + 260_000)).toBe(false)
    addMarker(store, s.id, 'besprechen', t0 + 300_000)
    endSession(store, s.id, t0 + 330_000)

    const saved = findSession(store.activeWorkshop(), s.id)!
    expect(saved.status).toBe('ended')
    expect(saved.durationSec).toBe(270) // 330 s minus 60 s Pause
    expect(saved.markers.map(m => [m.t, m.kind])).toEqual([
      [134, 'stark'],
      [240, 'besprechen'],
    ])
    expect(elapsedSec(saved)).toBe(270)
  })

  it('ends a stale running session when a new one starts', async () => {
    const { store, ws, p } = await setup()
    const a = startSession(store, ws.id, p.id, 1000)
    const b = startSession(store, ws.id, p.id, 5000)
    const w = store.activeWorkshop()!
    expect(findSession(w, a.id)?.status).toBe('ended')
    expect(findSession(w, b.id)?.status).toBe('running')
  })
})
