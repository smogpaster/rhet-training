// Ablage der Aufnahmen in IndexedDB (laut Even-FAQ "best effort", aber für
// große Blobs die einzige sinnvolle Option). Der Schlüssel ist die Session-ID.
const DB_NAME = 'rhet-audio'
const STORE = 'recordings'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB nicht verfügbar'))
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = fn(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        t.oncomplete = () => db.close()
      }),
  )
}

export const audioStore = {
  async save(sessionId: string, wav: Blob): Promise<boolean> {
    try {
      await tx('readwrite', s => s.put(wav, sessionId))
      return true
    } catch (err) {
      console.warn('Aufnahme konnte nicht gespeichert werden', err)
      return false
    }
  },
  async load(sessionId: string): Promise<Blob | null> {
    try {
      return (await tx<Blob | undefined>('readonly', s => s.get(sessionId))) ?? null
    } catch {
      return null
    }
  },
  async remove(sessionId: string): Promise<void> {
    try {
      await tx('readwrite', s => s.delete(sessionId))
    } catch {
      /* nichts zu löschen */
    }
  },
  async removeMany(sessionIds: string[]): Promise<void> {
    for (const id of sessionIds) await this.remove(id)
  },
}
