import { emptyData, type AppData, type Workshop } from './model'
import { loadChunked, saveChunked, type KeyValueStore } from './storage'

export const STORAGE_PREFIX = 'rhet.v1.data'

type Listener = (data: AppData) => void

/**
 * Zentraler Zustand der App mit Persistenz.
 * - `update()` verändert die Daten und speichert entprellt (500 ms).
 * - `flush()` erzwingt das Speichern, z. B. beim Verlassen der App.
 */
export class Store {
  private data: AppData = emptyData()
  private listeners = new Set<Listener>()
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private saving: Promise<void> = Promise.resolve()
  private dirty = false

  constructor(private primary: KeyValueStore, private mirror?: KeyValueStore) {}

  get(): AppData {
    return this.data
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async load(): Promise<void> {
    let raw = await loadChunked(this.primary, STORAGE_PREFIX)
    if (raw === null && this.mirror) raw = await loadChunked(this.mirror, STORAGE_PREFIX)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as AppData
        if (parsed && parsed.version === 1 && Array.isArray(parsed.workshops)) this.data = { ...emptyData(), ...parsed }
      } catch (err) {
        console.warn('Gespeicherte Daten konnten nicht gelesen werden', err)
      }
    }
    this.emit()
  }

  update(mutate: (draft: AppData) => void): void {
    // Kopie, damit Preact Änderungen erkennt und Listener nie ein halb geändertes Objekt sehen.
    const draft = structuredClone(this.data)
    mutate(draft)
    this.data = draft
    this.dirty = true
    this.emit()
    this.scheduleSave()
  }

  /** Speichert sofort (wartet auf laufende Schreibvorgänge). */
  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    if (!this.dirty) return this.saving
    this.dirty = false
    const raw = JSON.stringify(this.data)
    this.saving = this.saving.then(async () => {
      const ok = await saveChunked(this.primary, STORAGE_PREFIX, raw)
      if (!ok) console.warn('Speichern im Hauptspeicher fehlgeschlagen')
      if (this.mirror) await saveChunked(this.mirror, STORAGE_PREFIX, raw)
    })
    return this.saving
  }

  // Bequeme Zugriffe
  activeWorkshop(): Workshop | null {
    const d = this.data
    return d.workshops.find(w => w.id === d.activeWorkshopId) ?? null
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => void this.flush(), 500)
  }

  private emit() {
    for (const l of this.listeners) l(this.data)
  }
}
