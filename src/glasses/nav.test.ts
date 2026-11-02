import { describe, expect, it } from 'vitest'
import { Store } from '../data/store'
import { MemoryStore } from '../data/storage'
import { newGroup, newParticipant, newWorkshop, type Participant } from '../data/model'
import { MockHost } from './mockHost'
import { Renderer } from './render'
import { Navigator } from './nav'
import { HomeScreen } from './screens/home'
import { SeatMapScreen } from './screens/seatMap'
import { MENU } from './screens/common'
import { normalizeEvent } from './input'

const flush = (ms = 10) => new Promise(r => setTimeout(r, ms))

async function setup(people: Participant[], configure?: (ws: ReturnType<typeof newWorkshop>) => void) {
  const store = new Store(new MemoryStore())
  await store.load()
  const ws = newWorkshop('WS')
  ws.participants.push(...people)
  configure?.(ws)
  store.update(d => {
    d.workshops.push(ws)
    d.activeWorkshopId = ws.id
  })
  const host = new MockHost()
  const nav = new Navigator(store, new Renderer(host), host)
  nav.seatMapFactory = n => new SeatMapScreen(n)
  host.onEvenHubEvent(e => {
    const i = normalizeEvent(e)
    if (i) nav.handle(i)
  })
  nav.push(new HomeScreen(nav))
  await flush()
  return { host, nav, store }
}

const simple = (names: string[]) => names.map((n, i) => newParticipant(n, `Notiz ${n}`, { row: 1, col: i + 1 }))
/** Startseite: 0 Sitzplan, 1 Teilnehmende, 2 Session starten, 3 App beenden */
async function openHomeItem(host: MockHost, index: number) {
  for (let i = 0; i < index; i++) host.input('down')
  host.input('click')
  await flush()
}
const text = (host: MockHost, name: string) => host.page?.texts.find(t => t.name === name)?.content ?? ''

describe('glasses navigation', () => {
  it('opens participants and a profile, swipes through people', async () => {
    const { host } = await setup(simple(['Anna', 'Ben']))
    expect(host.page?.lists[0].items[0]).toBe('Sitzplan (wer sitzt wo?)')
    await openHomeItem(host, 1)
    expect(host.page?.lists[0].items).toEqual(['Anna', 'Ben'])

    host.input('down')
    host.input('click')
    await flush()
    expect(text(host, 'head')).toContain('Ben')
    expect(text(host, 'detail')).toContain('Reihe 1, Platz 2')

    host.input('down') // wraps around to Anna
    await flush()
    expect(text(host, 'head')).toContain('Anna')
  })

  it('pages long participant lists', async () => {
    const { host } = await setup(Array.from({ length: 25 }, (_, i) => newParticipant(`P${i + 1}`)))
    await openHomeItem(host, 1)
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
    const { host } = await setup(simple(['Anna']))
    host.menuClick(MENU.EXIT)
    await flush()
    expect(host.exitRequested).toBe(true)
  })
})

describe('seat map', () => {
  const uPeople = () => {
    const a = { ...newParticipant('Matthias Bucher', '', { row: 2, col: 1 }), introOrder: 1, profile: { role: 'Außendienst', experience: '8,5 Jahre', area: 'Württemberg', background: '', answer: 'Hat aktuell keinen festen Türöffner.', board: '', tip: '', evidence: '' } }
    const b = { ...newParticipant('Matthias Göttlicher', '', { row: 3, col: 2 }), introOrder: 2, profile: { role: 'Außendienst', experience: '3 Jahre', area: '', background: '', answer: '', board: 'einfach Hallo sagen', tip: 'Abwimmler-Werkstatt', evidence: '' } }
    const c = { ...newParticipant('Sarah Albrecht', '', { row: 1, col: 4 }), introOrder: 3 }
    return [a, b, c]
  }

  it('draws a U with short names and highlights the selection', async () => {
    const { host } = await setup(uPeople(), ws => (ws.layout = { kind: 'u', rows: 3, cols: 4 }))
    await openHomeItem(host, 0)
    expect(text(host, 'back')).toContain('Matthias G.')
    expect(text(host, 'left')).toContain('▶Matthias B.')
    expect(text(host, 'right')).toContain('Sarah')
    expect(text(host, 'info')).toContain('Matthias Bucher · Außendienst  1/3')

    host.input('down')
    await flush()
    expect(text(host, 'back')).toContain('▶Matthias G.')
    expect(text(host, 'info')).toContain('» einfach Hallo sagen')
  })

  it('opens the short profile with board keyword and falls back to the first sentence', async () => {
    const { host } = await setup(uPeople(), ws => (ws.layout = { kind: 'u', rows: 3, cols: 4 }))
    await openHomeItem(host, 0)
    host.input('click')
    await flush()
    expect(text(host, 'head')).toContain('» Hat aktuell keinen festen Türöffner.')
    host.input('down')
    await flush()
    expect(text(host, 'head')).toContain('» einfach Hallo sagen')
    expect(text(host, 'detail')).toContain('Heute: Abwimmler-Werkstatt')
  })

  it('records person markers and returns via long press', async () => {
    const { host, store } = await setup(uPeople(), ws => (ws.layout = { kind: 'u', rows: 3, cols: 4 }))
    await openHomeItem(host, 0)
    host.input('click')
    await flush()
    host.input('click')
    await flush(500)
    host.input('double_click')
    await flush()
    const notes = store.activeWorkshop()!.notes
    expect(notes.map(n => n.kind)).toEqual(['stark', 'besprechen'])
    expect(text(host, 'status')).toContain('● besprechen')

    host.menuClick(MENU.UNDO_MARKER)
    await flush()
    expect(store.activeWorkshop()!.notes.map(n => n.kind)).toEqual(['stark'])

    host.input('long_press')
    await flush()
    expect(text(host, 'info')).toContain('Matthias Bucher')
    expect(host.page?.texts.some(t => t.name === 'left')).toBe(true)
  })

  it('drops a tap marker that was the start of a long press', async () => {
    const { host, store } = await setup(uPeople(), ws => (ws.layout = { kind: 'u', rows: 3, cols: 4 }))
    await openHomeItem(host, 0)
    host.input('click')
    await flush()
    host.input('click')
    host.input('long_press')
    await flush()
    expect(store.activeWorkshop()!.notes).toHaveLength(0)
  })

  it('long press from the home screen opens the seat map', async () => {
    const { host } = await setup(uPeople(), ws => (ws.layout = { kind: 'u', rows: 3, cols: 4 }))
    host.input('long_press')
    await flush()
    expect(host.page?.texts.some(t => t.name === 'back')).toBe(true)
  })

  it('filters by group via the context menu', async () => {
    const people = uPeople()
    const { host } = await setup(people, ws => {
      ws.layout = { kind: 'u', rows: 3, cols: 4 }
      const g = newGroup('Innendienst', 0)
      ws.groups.push(g)
      ws.participants[2].groupId = g.id
    })
    await openHomeItem(host, 0)
    host.menuClick(MENU.FILTER)
    await flush()
    expect(text(host, 'info')).toContain('Sarah Albrecht')
    expect(text(host, 'info')).toContain('[Innendienst]')
    expect(text(host, 'right')).toContain('▶Sarah')
  })

  it('renders rows and tables', async () => {
    const { host } = await setup(simple(['Anna', 'Ben']), ws => (ws.layout = { kind: 'tables', rows: 2, cols: 3 }))
    await openHomeItem(host, 0)
    expect(host.page?.texts.find(t => t.name === 'a0')?.content).toMatch(/^T1: ▶Anna {2}Ben/)
  })
})

describe('session flow', () => {
  async function startFor(host: MockHost) {
    await openHomeItem(host, 2) // Session starten
    host.input('click') // erste Person
    await flush()
  }

  it('starts a session, records markers by tap and double tap, ends via menu', async () => {
    const { host, store } = await setup(simple(['Anna']), ws => (ws.consentConfirmed = true))
    await startFor(host)
    expect(text(host, 'time')).toMatch(/^00:0\d$/)
    expect(host.page?.menu.map(m => m.label)).toEqual(['Pause', 'Session beenden', 'App beenden'])

    host.input('click')
    await flush()
    expect(text(host, 'confirm')).toMatch(/● stark  00:0\d/)
    await flush(500)
    host.input('double_click')
    await flush()
    expect(store.activeWorkshop()!.sessions[0].markers.map(m => m.kind)).toEqual(['stark', 'besprechen'])

    host.input('long_press') // während der Rede kein Sprung zum Sitzplan
    await flush()
    expect(text(host, 'time')).toMatch(/^00:0\d/)

    host.menuClick(MENU.SESSION_END)
    await flush()
    expect(store.activeWorkshop()!.sessions[0].status).toBe('ended')
    expect(text(host, 'review')).toContain('Anna · 00:0')

    host.input('double_click') // zur Startseite
    await flush()
    expect(host.page?.lists[0].items[0]).toBe('Sitzplan (wer sitzt wo?)')
  })

  it('refuses to start without consent', async () => {
    const { host, store } = await setup(simple(['Anna']))
    await startFor(host)
    expect(text(host, 'title')).toContain('Einwilligung')
    expect(store.activeWorkshop()!.sessions).toHaveLength(0)
  })

  it('converts a tap that was part of a double tap', async () => {
    const { host, store } = await setup(simple(['Anna']), ws => (ws.consentConfirmed = true))
    await startFor(host)
    host.input('click')
    host.input('double_click')
    await flush()
    expect(store.activeWorkshop()!.sessions[0].markers.map(m => m.kind)).toEqual(['besprechen'])
  })
})
