import { describe, expect, it } from 'vitest'
import { Store } from './store'
import { MemoryStore, loadChunked, saveChunked } from './storage'
import { newParticipant, newWorkshop } from './model'

describe('chunked storage', () => {
  it('round-trips values larger than one chunk', async () => {
    const kv = new MemoryStore()
    const big = 'ä'.repeat(120_000) + 'ende'
    expect(await saveChunked(kv, 'p', big)).toBe(true)
    expect(kv.map.get('p.n')).toBe('3')
    expect(await loadChunked(kv, 'p')).toBe(big)
  })

  it('returns null when nothing is stored', async () => {
    expect(await loadChunked(new MemoryStore(), 'p')).toBeNull()
  })
})

describe('Store', () => {
  it('persists updates and loads them again', async () => {
    const kv = new MemoryStore()
    const store = new Store(kv)
    await store.load()
    const ws = newWorkshop('Test-Workshop')
    ws.participants.push(newParticipant('Anna', 'Stimme'))
    store.update(d => {
      d.workshops.push(ws)
      d.activeWorkshopId = ws.id
    })
    await store.flush()

    const store2 = new Store(kv)
    await store2.load()
    expect(store2.activeWorkshop()?.title).toBe('Test-Workshop')
    expect(store2.activeWorkshop()?.participants[0].name).toBe('Anna')
  })

  it('falls back to the mirror store when the primary is empty', async () => {
    const primary = new MemoryStore()
    const mirror = new MemoryStore()
    const s1 = new Store(mirror)
    await s1.load()
    s1.update(d => void d.workshops.push(newWorkshop('Spiegel')))
    await s1.flush()

    const s2 = new Store(primary, mirror)
    await s2.load()
    expect(s2.get().workshops[0].title).toBe('Spiegel')
  })
})
