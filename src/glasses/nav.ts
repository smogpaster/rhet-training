import type { Store } from '../data/store'
import type { GlassesHost } from './host'
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
  /** true: Bildschirm aktualisiert sich selbst, kein Neuaufbau bei Datenänderungen (vermeidet Flackern). */
  selfUpdating?: boolean
  /** true: langes Drücken springt hier nicht zum Sitzplan (z. B. laufende Aufnahme) */
  blocksQuickAccess?: boolean
  /** markiert den Sitzplan-Bildschirm (Ziel des Schnellzugriffs) */
  isSeatMap?: boolean
}

/** Navigations-Kontext, den jeder Bildschirm bekommt. */
export interface Nav {
  store: Store
  renderer: Renderer
  host: GlassesHost
  push(screen: Screen): void
  pop(): void
  replace(screen: Screen): void
  /** Tiefe des Navigationsstapels (1 = Startseite). */
  depth(): number
  /** Aktuellen Bildschirm komplett neu zeichnen. */
  render(): void
  /** Nur einen Textcontainer aktualisieren (flackerfrei). */
  updateText(id: number, name: string, content: string, textColor?: number): void
  exitApp(): void
  /** Schnellzugriff „Wer sitzt wo?“: zum Sitzplan zurück oder ihn öffnen. */
  quickAccess(): void
}

export class Navigator implements Nav {
  private stack: Screen[] = []
  /** Erzeugt den Sitzplan-Bildschirm (wird in main.ts gesetzt, vermeidet zyklische Importe). */
  seatMapFactory: ((nav: Nav) => Screen) | null = null

  constructor(public store: Store, public renderer: Renderer, public host: GlassesHost) {}

  get current(): Screen | undefined {
    return this.stack[this.stack.length - 1]
  }

  depth(): number {
    return this.stack.length
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

  /** Neuaufbau nach Datenänderung vom iPhone, außer der Bildschirm pflegt sich selbst. */
  renderAfterDataChange() {
    if (!this.current?.selfUpdating) this.render()
  }

  updateText(id: number, name: string, content: string, textColor?: number) {
    void this.renderer.updateText(id, name, content, textColor)
  }

  exitApp() {
    void this.renderer.shutDown(1)
  }

  quickAccess() {
    const idx = this.stack.findIndex(s => s.isSeatMap)
    if (idx >= 0) {
      if (idx === this.stack.length - 1) return
      while (this.stack.length - 1 > idx) this.stack.pop()?.onLeave?.()
      this.render()
      return
    }
    if (this.seatMapFactory) this.push(this.seatMapFactory(this))
  }

  handle(input: GlassesInput) {
    if (input.kind === 'foreground') {
      this.render()
      this.current?.onInput(input)
      return
    }
    if (input.kind === 'exit') {
      this.current?.onLeave?.()
      return
    }
    if (input.kind === 'longRelease') return
    if (input.kind === 'longPress') {
      // Bildschirm darf zuerst reagieren (z. B. Marker-Schutz), danach Schnellzugriff
      this.current?.onInput(input)
      if (!this.current?.blocksQuickAccess) this.quickAccess()
      return
    }
    this.current?.onInput(input)
  }
}
