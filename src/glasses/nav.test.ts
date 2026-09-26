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
  const nav = new Navigator(store, new Renderer(host), host)
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

describe('session flow', () => {
  it('starts a session, records markers by tap and double tap, ends via menu', async () => {
    const { host, store } = await setup(['Anna'])
    store.update(d => void (d.workshops[0].consentConfirmed = true))
    host.input('down') // "Session starten"
    host.input('click')
    await flush()
    host.input('click') // Anna
    await flush()
    host.input('click') // Session starten
    await flush()
    expect(host.page?.texts[0].content).toMatch(/^00:0\d$/)
    expect(host.page?.menu.map(m => m.label)).toEqual(['Pause', 'Session beenden', 'App beenden'])

    host.input('click')
    await flush()
    expect(host.page?.texts[1].content).toMatch(/● stark  00:0\d/)
    await new Promise(r => setTimeout(r, 500)) // deutlich nach dem Einfachtipp
    host.input('double_click')
    await flush()
    const running = store.activeWorkshop()!.sessions[0]
    expect(running.markers.map(m => m.kind)).toEqual(['stark', 'besprechen'])

    host.menuClick(4) // Session beenden
    await flush()
    const ended = store.activeWorkshop()!.sessions[0]
    expect(ended.status).toBe('ended')
    expect(host.page?.texts[0].content).toContain('Anna · 00:0')
    expect(host.page?.texts[0].content).toContain('stark')

    host.input('double_click') // zur Startseite
    await flush()
    expect(host.page?.lists[0].items[0]).toBe('Teilnehmende')
  })

  it('refuses to start without consent', async () => {
    const { host } = await setup(['Anna'])
    host.input('click')
    await flush()
    host.input('click')
    await flush()
    host.input('click')
    await flush()
    expect(host.page?.texts[1].content).toContain('Einwilligung')
  })

  it('converts a tap that was part of a double tap', async () => {
    const { host, store } = await setup(['Anna'])
    store.update(d => void (d.workshops[0].consentConfirmed = true))
    host.input('down'); host.input('click'); await flush()
    host.input('click'); await flush()
    host.input('click'); await flush()
    host.input('click')
    host.input('double_click')
    await flush()
    expect(store.activeWorkshop()!.sessions[0].markers.map(m => m.kind)).toEqual(['besprechen'])
  })
})
