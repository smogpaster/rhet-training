import { render } from 'preact'
import { h } from 'preact'
import { seedDemo } from './data/demo'
import { Store } from './data/store'
import { BrowserStore } from './data/storage'
import { connectRealHost, type GlassesHost } from './glasses/host'
import { HostStore } from './glasses/hostStorage'
import { normalizeEvent } from './glasses/input'
import { MockHost } from './glasses/mockHost'
import { Navigator } from './glasses/nav'
import { Renderer } from './glasses/render'
import { HomeScreen } from './glasses/screens/home'
import { App } from './phone/App'

async function main() {
  // 1. Verbindung zur Even-App. Ohne Host (Desktop-Browser) läuft die Vorschau.
  const real = await connectRealHost()
  const mock = real ? null : new MockHost()
  const host: GlassesHost = real ?? mock!

  // 2. Daten laden: Hauptspeicher ist die Even-App, Browser-localStorage als Spiegel.
  const store = new Store(real ? new HostStore(real) : new BrowserStore(), real ? new BrowserStore() : undefined)
  await store.load()
  const params = new URLSearchParams(location.search)
  if (params.has('demo')) {
    store.update(seedDemo)
    // Nur zum Testen im Simulator: ?demo&consent setzt die Einwilligung als bestätigt.
    if (params.has('consent')) store.update(d => d.workshops.forEach(w => void (w.consentConfirmed = true)))
  }

  // 3. iPhone-Oberfläche
  render(h(App, { store, mock }), document.getElementById('app')!)

  // 4. Brillen-Oberfläche
  const nav = new Navigator(store, new Renderer(host), host)
  const unsubscribe = host.onEvenHubEvent(event => {
    const input = normalizeEvent(event)
    if (!input) return
    if (input.kind === 'exit') {
      nav.handle(input)
      void store.flush()
      unsubscribe()
      return
    }
    if (input.kind === 'background') void store.flush()
    nav.handle(input)
  })
  nav.push(new HomeScreen(nav))

  // Datenänderungen vom iPhone (z. B. neue Person) auf der Brille nachziehen.
  let renderTimer: ReturnType<typeof setTimeout> | null = null
  store.subscribe(() => {
    if (renderTimer) clearTimeout(renderTimer)
    renderTimer = setTimeout(() => nav.renderAfterDataChange(), 300)
  })

  window.addEventListener('beforeunload', () => void store.flush())
}

main().catch(err => {
  console.error(err)
  document.getElementById('app')!.textContent = `Fehler beim Start: ${(err as Error).message}`
})
