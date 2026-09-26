// Ersatz für die Even-App-Bridge, wenn die Seite in einem normalen Browser läuft.
// Merkt sich die aktuelle Seite und liefert simulierte Eingaben, damit die
// Brillen-Logik ohne Simulator und ohne Hardware ausprobiert werden kann.
import {
  OsEventTypeList,
  type CreateStartUpPageContainer,
  type EvenHubEvent,
  type RebuildPageContainer,
  type TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import type { GlassesHost } from './host'

export interface MockText {
  id: number
  name: string
  content: string
  x: number
  y: number
  w: number
  h: number
  textColor?: number
  capture: boolean
}
export interface MockList {
  id: number
  name: string
  items: string[]
  x: number
  y: number
  w: number
  h: number
  capture: boolean
}
export interface MockPage {
  texts: MockText[]
  lists: MockList[]
  menu: Array<{ id: number; label: string }>
  /** Markierter Listeneintrag (Firmware-Scrollzustand) */
  selected: number
}

export type MockAction = 'up' | 'down' | 'click' | 'double_click' | 'long_press' | 'long_press_release'

type PageInput = CreateStartUpPageContainer | RebuildPageContainer

export class MockHost implements GlassesHost {
  page: MockPage | null = null
  exitRequested = false
  private listeners = new Set<(e: EvenHubEvent) => void>()
  private pageListeners = new Set<(p: MockPage | null) => void>()
  private storage = new Map<string, string>()

  onPageChange(cb: (p: MockPage | null) => void): () => void {
    this.pageListeners.add(cb)
    cb(this.page)
    return () => this.pageListeners.delete(cb)
  }

  private setPage(input: PageInput) {
    this.page = {
      texts: (input.textObject ?? []).map(t => ({
        id: t.containerID ?? 0,
        name: t.containerName ?? '',
        content: t.content ?? '',
        x: t.xPosition ?? 0,
        y: t.yPosition ?? 0,
        w: t.width ?? 576,
        h: t.height ?? 288,
        textColor: t.textColor,
        capture: t.isEventCapture === 1,
      })),
      lists: (input.listObject ?? []).map(l => ({
        id: l.containerID ?? 0,
        name: l.containerName ?? '',
        items: l.itemContainer?.itemName ?? [],
        x: l.xPosition ?? 0,
        y: l.yPosition ?? 0,
        w: l.width ?? 576,
        h: l.height ?? 288,
        capture: l.isEventCapture === 1,
      })),
      menu: (input.menuObject?.menuItems ?? []).map(m => ({ id: m.itemID ?? 0, label: m.itemName ?? '' })),
      selected: 0,
    }
    this.notifyPage()
  }

  private notifyPage() {
    for (const cb of this.pageListeners) cb(this.page ? { ...this.page } : null)
  }

  async createStartUpPageContainer(container: CreateStartUpPageContainer): Promise<number> {
    this.setPage(container)
    return 0
  }
  async rebuildPageContainer(container: RebuildPageContainer): Promise<boolean> {
    this.setPage(container)
    return true
  }
  async textContainerUpgrade(c: TextContainerUpgrade): Promise<boolean> {
    const t = this.page?.texts.find(x => x.id === c.containerID && x.name === c.containerName)
    if (!t) return false
    t.content = c.content ?? ''
    if (c.textColor !== undefined) t.textColor = c.textColor
    this.notifyPage()
    return true
  }
  async shutDownPageContainer(): Promise<boolean> {
    this.exitRequested = true
    this.notifyPage()
    return true
  }
  async audioControl(): Promise<boolean> {
    return true
  }
  async setLocalStorage(key: string, value: string): Promise<boolean> {
    this.storage.set(key, value)
    return true
  }
  async getLocalStorage(key: string): Promise<string> {
    return this.storage.get(key) ?? ''
  }
  onEvenHubEvent(callback: (event: EvenHubEvent) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  emit(event: EvenHubEvent) {
    for (const l of this.listeners) l(event)
  }

  /** Simulierte Touch-Eingabe, wie sie die Firmware je nach aktivem Container liefert. */
  input(action: MockAction) {
    const page = this.page
    if (!page) return
    const list = page.lists.find(l => l.capture)
    // eventSource 2 = Ring
    const sys = (eventType?: OsEventTypeList): EvenHubEvent => ({ sysEvent: { eventType, eventSource: 2 } as EvenHubEvent['sysEvent'] })
    if (list) {
      if (action === 'up' || action === 'down') {
        const n = list.items.length
        page.selected = Math.max(0, Math.min(n - 1, page.selected + (action === 'up' ? -1 : 1)))
        this.notifyPage()
        return
      }
      if (action === 'click') {
        const idx = page.selected
        this.emit({ listEvent: { containerID: list.id, containerName: list.name, currentSelectItemIndex: idx || undefined, currentSelectItemName: list.items[idx] } as EvenHubEvent['listEvent'] })
        return
      }
    } else {
      if (action === 'up') return this.emit({ textEvent: { eventType: OsEventTypeList.SCROLL_TOP_EVENT } as EvenHubEvent['textEvent'] })
      if (action === 'down') return this.emit({ textEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT } as EvenHubEvent['textEvent'] })
      if (action === 'click') return this.emit(sys(undefined))
    }
    if (action === 'double_click') return this.emit(sys(OsEventTypeList.DOUBLE_CLICK_EVENT))
    if (action === 'long_press') return this.emit(sys(OsEventTypeList.LONG_PRESS_EVENT))
    if (action === 'long_press_release') return this.emit(sys(OsEventTypeList.LONG_PRESS_RELEASE_EVENT))
  }

  /** Auswahl eines Kontextmenü-Eintrags (Reihenfolge laut Doku: Vordergrund-Ereignisse drumherum). */
  menuClick(itemId: number) {
    this.emit({ sysEvent: { eventType: OsEventTypeList.FOREGROUND_ENTER_EVENT } as EvenHubEvent['sysEvent'] })
    this.emit({ menuItemClickEvent: { itemID: itemId } as EvenHubEvent['menuItemClickEvent'] })
    this.emit({ sysEvent: { eventType: OsEventTypeList.FOREGROUND_EXIT_EVENT } as EvenHubEvent['sysEvent'] })
  }
}
