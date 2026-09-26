import type { GlassesInput } from '../input'
import type { PageSpec } from '../page'
import type { Nav, Screen } from '../nav'
import { MENU, MENU_EXIT } from './common'
import { ParticipantsScreen } from './participants'

const ITEMS = ['Teilnehmende', 'Session starten', 'App beenden'] as const

/** Startseite: einfache Liste, Auswahl per Tipp. */
export class HomeScreen implements Screen {
  constructor(private nav: Nav) {}

  page(): PageSpec {
    const ws = this.nav.store.activeWorkshop()
    const title = ws ? ws.title : 'Kein Workshop gewählt (iPhone)'
    return {
      texts: [{ id: 1, name: 'title', content: title, x: 0, y: 0, w: 576, h: 40, textColor: 2, padding: 6 }],
      lists: [{ id: 2, name: 'menu', items: [...ITEMS], x: 0, y: 44, w: 576, h: 244, capture: true }],
      menu: [MENU_EXIT],
    }
  }

  onInput(input: GlassesInput) {
    if (input.kind === 'menu' && input.itemId === MENU.EXIT) return this.nav.exitApp()
    if (input.kind === 'select') {
      if (input.index === 0) return this.nav.push(new ParticipantsScreen(this.nav))
      if (input.index === 1) return this.nav.push(new ParticipantsScreen(this.nav, { pickForSession: true }))
      if (input.index === 2) return this.nav.exitApp()
    }
  }
}
