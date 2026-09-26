import { useEffect, useState } from 'preact/hooks'
import type { AppData } from '../data/model'
import type { Store } from '../data/store'

/** Preact-Hook: liefert den aktuellen Zustand und rendert bei Änderungen neu. */
export function useStore(store: Store): AppData {
  const [data, setData] = useState(store.get())
  useEffect(() => store.subscribe(setData), [store])
  return data
}
