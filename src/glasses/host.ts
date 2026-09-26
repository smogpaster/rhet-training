// Schmale Schnittstelle zur Brille. Die echte EvenAppBridge erfüllt sie strukturell,
// der MockHost (Desktop-Browser ohne Even-App) ebenfalls.
import {
  waitForEvenAppBridge,
  type AudioInputSource,
  type CreateStartUpPageContainer,
  type EvenHubEvent,
  type RebuildPageContainer,
  type TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'

export interface GlassesHost {
  createStartUpPageContainer(container: CreateStartUpPageContainer): Promise<number>
  rebuildPageContainer(container: RebuildPageContainer): Promise<boolean>
  textContainerUpgrade(container: TextContainerUpgrade): Promise<boolean>
  shutDownPageContainer(exitMode?: number): Promise<boolean>
  audioControl(isOpen: boolean, source?: AudioInputSource): Promise<boolean>
  setLocalStorage(key: string, value: string): Promise<boolean>
  getLocalStorage(key: string): Promise<string>
  onEvenHubEvent(callback: (event: EvenHubEvent) => void): () => void
}

/** Even-App und Simulator stellen `window.flutter_inappwebview.callHandler` bereit. */
export function hasEvenHost(): boolean {
  const w = window as unknown as { flutter_inappwebview?: { callHandler?: unknown } }
  return typeof w.flutter_inappwebview?.callHandler === 'function'
}

/**
 * Wartet auf die Even-App-Bridge. Läuft die Seite in einem normalen Browser
 * (kein Even-Host), wird `null` geliefert. Das SDK meldet sich auch ohne Host
 * als "bereit", deshalb wird zusätzlich auf den Flutter-Handler geprüft.
 */
export async function connectRealHost(timeoutMs = 1500): Promise<GlassesHost | null> {
  if (!hasEvenHost()) {
    console.log('[Rhetoriktrainer] Kein Even-Host gefunden, Vorschau-Modus')
    return null
  }
  const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs))
  const result = await Promise.race([waitForEvenAppBridge(), timeout])
  console.log('[Rhetoriktrainer] Even-Host:', result ? 'verbunden' : 'Bridge nicht bereit')
  return result as GlassesHost | null
}
