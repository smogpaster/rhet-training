import type { GlassesInput } from '../input'
import type { PageSpec } from '../page'
import type { Nav, Screen } from '../nav'
import { MENU, MENU_EXIT } from './common'
import { runningSession } from '../../session/session'
import { ParticipantsScreen } from './participants'
import { SessionScreen } from './session'

type Item = { label: string; run: () => void }

/** Startseite: einfache Liste, Auswahl per Tipp. */
export class HomeScreen implements Screen {
  constructor(private nav: Nav) {}

  private items(): Item[] {
    const ws = this.nav.store.activeWorkshop()
    const items: Item[] = []
    const running = runningSession(ws)
    if (running && ws) {
      const name = ws.participants.find(p => p.id === running.participantId)?.name ?? 'Unbekannt'
      items.push({ label: `▶ Session fortsetzen: ${name}`, run: () => this.nav.push(new SessionScreen(this.nav, running.id)) })
    }
    items.push(
      { label: 'Teilnehmende', run: () => this.nav.push(new ParticipantsScreen(this.nav)) },
      { label: 'Session starten', run: () => this.nav.push(new ParticipantsScreen(this.nav, { pickForSession: true })) },
      { label: 'App beenden', run: () => this.nav.exitApp() },
    )
    return items
  }

  page(): PageSpec {
    const ws = this.nav.store.activeWorkshop()
    const title = ws ? ws.title : 'Kein Workshop gewählt (iPhone)'
    return {
      texts: [{ id: 1, name: 'title', content: title, x: 0, y: 0, w: 576, h: 40, textColor: 2, padding: 6 }],
      lists: [{ id: 2, name: 'menu', items: this.items().map(i => i.label), x: 0, y: 44, w: 576, h: 244, capture: true }],
      menu: [MENU_EXIT],
    }
  }

  onInput(input: GlassesInput) {
    if (input.kind === 'menu' && input.itemId === MENU.EXIT) return this.nav.exitApp()
    if (input.kind === 'select') this.items()[input.index]?.run()
  }
}
