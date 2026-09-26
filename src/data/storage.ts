// Persistenz-Adapter. Der offizielle Weg in der Even-App ist bridge.setLocalStorage /
// getLocalStorage (nur Strings). Große JSON-Inhalte werden in Blöcke aufgeteilt.

export interface KeyValueStore {
  get(key: string): Promise<string>
  set(key: string, value: string): Promise<boolean>
}

const CHUNK_SIZE = 50_000

export async function saveChunked(store: KeyValueStore, prefix: string, value: string): Promise<boolean> {
  const chunks = Math.max(1, Math.ceil(value.length / CHUNK_SIZE))
  for (let i = 0; i < chunks; i++) {
    const ok = await store.set(`${prefix}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE))
    if (!ok) return false
  }
  // Anzahl zuletzt schreiben, damit ein abgebrochener Schreibvorgang nicht als vollständig gilt.
  return store.set(`${prefix}.n`, String(chunks))
}

export async function loadChunked(store: KeyValueStore, prefix: string): Promise<string | null> {
  const nText = await store.get(`${prefix}.n`)
  const n = Number(nText)
  if (!nText || !Number.isInteger(n) || n < 1) return null
  let out = ''
  for (let i = 0; i < n; i++) out += await store.get(`${prefix}.${i}`)
  return out
}

/** Browser-localStorage, für Entwicklung im Desktop-Browser und als Spiegel. */
export class BrowserStore implements KeyValueStore {
  async get(key: string): Promise<string> {
    try {
      return window.localStorage.getItem(key) ?? ''
    } catch {
      return ''
    }
  }
  async set(key: string, value: string): Promise<boolean> {
    try {
      window.localStorage.setItem(key, value)
      return true
    } catch {
      return false
    }
  }
}

/** Speicher im Arbeitsspeicher, für Tests. */
export class MemoryStore implements KeyValueStore {
  map = new Map<string, string>()
  async get(key: string): Promise<string> {
    return this.map.get(key) ?? ''
  }
  async set(key: string, value: string): Promise<boolean> {
    this.map.set(key, value)
    return true
  }
}
