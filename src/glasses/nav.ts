import type { Store } from '../data/store'
import type { GlassesInput } from './input'
import type { PageSpec } from './page'
import type { Renderer } from './render'

/** Ein Bildschirm auf der Brille. */
export interface Screen {
  /** Liefert die komplette Seite (wird bei Anzeige und nach Datenänderungen gerendert). */
  page(): PageSpec
  onInput(input: GlassesInput): void
  /** Wird beim Verlassen aufgerufen (Timer stoppen etc.). */
  onLeave?(): void
}

/** Navigations-Kontext, den jeder Bildschirm bekommt. */
export interface Nav {
  store: Store
  renderer: Renderer
  push(screen: Screen): void
  pop(): void
  replace(screen: Screen): void
  /** Aktuellen Bildschirm komplett neu zeichnen. */
  render(): void
  /** Nur einen Textcontainer aktualisieren (flackerfrei). */
  updateText(id: number, name: string, content: string, textColor?: number): void
  exitApp(): void
}

export class Navigator implements Nav {
  private stack: Screen[] = []

  constructor(public store: Store, public renderer: Renderer) {}

  get current(): Screen | undefined {
    return this.stack[this.stack.length - 1]
  }

  push(screen: Screen) {
    this.current?.onLeave?.()
    this.stack.push(screen)
    this.render()
  }

  pop() {
    if (this.stack.length <= 1) return
    this.stack.pop()?.onLeave?.()
    this.render()
  }

  replace(screen: Screen) {
    this.stack.pop()?.onLeave?.()
    this.stack.push(screen)
    this.render()
  }

  render() {
    const s = this.current
    if (s) void this.renderer.showPage(s.page())
  }

  updateText(id: number, name: string, content: string, textColor?: number) {
    void this.renderer.updateText(id, name, content, textColor)
  }

  exitApp() {
    void this.renderer.shutDown(1)
  }

  handle(input: GlassesInput) {
    if (input.kind === 'foreground') {
      this.render()
      return
    }
    if (input.kind === 'exit') {
      this.current?.onLeave?.()
      return
    }
    this.current?.onInput(input)
  }
}
