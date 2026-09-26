import { describe, expect, it } from 'vitest'
import { Store } from '../data/store'
import { MemoryStore } from '../data/storage'
import { newParticipant, newWorkshop } from '../data/model'
import { MockHost } from './mockHost'
import { Renderer } from './render'
import { Navigator } from './nav'
import { HomeScreen } from './screens/home'
import { normalizeEvent } from './input'

async function setup(names: string[]) {
  const store = new Store(new MemoryStore())
  await store.load()
  const ws = newWorkshop('WS')
  for (const n of names) ws.participants.push(newParticipant(n, `Notiz ${n}`, { row: 1, col: 1 }))
  store.update(d => {
    d.workshops.push(ws)
    d.activeWorkshopId = ws.id
  })
  const host = new MockHost()
  const nav = new Navigator(store, new Renderer(host))
  host.onEvenHubEvent(e => {
    const i = normalizeEvent(e)
    if (i) nav.handle(i)
  })
  nav.push(new HomeScreen(nav))
  await flush()
  return { host, nav, store }
}

const flush = () => new Promise(r => setTimeout(r, 10))

describe('glasses navigation', () => {
  it('shows home, opens participants and a detail page', async () => {
    const { host } = await setup(['Anna', 'Ben'])
    expect(host.page?.lists[0].items[0]).toBe('Teilnehmende')

    host.input('click')
    await flush()
    expect(host.page?.lists[0].items).toEqual(['Anna', 'Ben'])

    host.input('down')
    host.input('click')
    await flush()
    expect(host.page?.texts[0].content).toContain('Ben')
    expect(host.page?.texts[0].content).toContain('Reihe 1, Platz 1')

    host.input('down') // wraps around to Anna
    await flush()
    expect(host.page?.texts[0].content).toContain('Anna')

    host.input('double_click')
    await flush()
    expect(host.page?.lists[0].items).toEqual(['Anna', 'Ben'])
  })

  it('pages long participant lists', async () => {
    const names = Array.from({ length: 25 }, (_, i) => `P${i + 1}`)
    const { host } = await setup(names)
    host.input('click')
    await flush()
    const items = host.page!.lists[0].items
    expect(items.length).toBeLessThanOrEqual(20)
    expect(items[items.length - 1]).toBe('▶ weitere')
    for (let i = 0; i < items.length - 1; i++) host.input('down')
    host.input('click')
    await flush()
    expect(host.page!.lists[0].items[0]).toBe('◀ vorherige')
    expect(host.page!.lists[0].items).toContain('P25')
  })

  it('exits via the context menu', async () => {
    const { host } = await setup(['Anna'])
    host.menuClick(3)
    await flush()
    expect(host.exitRequested).toBe(true)
  })
})
