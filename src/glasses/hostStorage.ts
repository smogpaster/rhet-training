import type { KeyValueStore } from '../data/storage'
import type { GlassesHost } from './host'

/** Persistenz über die Even-App (bridge.setLocalStorage / getLocalStorage). */
export class HostStore implements KeyValueStore {
  constructor(private host: GlassesHost) {}
  get(key: string): Promise<string> {
    return this.host.getLocalStorage(key).catch(() => '')
  }
  set(key: string, value: string): Promise<boolean> {
    return this.host.setLocalStorage(key, value).catch(() => false)
  }
}
