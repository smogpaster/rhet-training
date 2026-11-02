import { useState } from 'preact/hooks'
import type { Store } from '../data/store'
import type { GlassesHost } from '../glasses/host'
import type { MockHost } from '../glasses/mockHost'
import { ImportView } from './ImportView'
import { GlassesPreview } from './GlassesPreview'
import { ParticipantsView } from './ParticipantsView'
import { SessionsView } from './SessionsView'
import { SettingsView } from './SettingsView'
import { WorkshopsView } from './WorkshopsView'
import { useStore } from './useStore'

type Tab = 'workshops' | 'people' | 'import' | 'sessions' | 'settings'

export function App({ store, mock, host }: { store: Store; mock: MockHost | null; host: GlassesHost }) {
  const data = useStore(store)
  const [tab, setTab] = useState<Tab>(data.workshops.length ? 'people' : 'workshops')
  const ws = data.workshops.find(w => w.id === data.activeWorkshopId) ?? null

  return (
    <div>
      <header class="top">
        <h1>Rhetoriktrainer</h1>
        <span class={`status ${mock ? '' : 'live'}`}>{mock ? 'Vorschau-Modus' : 'Brille verbunden'}</span>
      </header>
      <main>
        {mock && <GlassesPreview host={mock} />}
        {tab === 'workshops' && <WorkshopsView store={store} data={data} />}
        {tab === 'people' && <ParticipantsView store={store} ws={ws} />}
        {tab === 'import' && <ImportView store={store} ws={ws} host={host} goTo={setTab} />}
        {tab === 'sessions' && <SessionsView store={store} ws={ws} />}
        {tab === 'settings' && <SettingsView store={store} data={data} ws={ws} />}
      </main>
      <nav class="tabs">
        {(
          [
            ['workshops', 'Workshops'],
            ['people', 'Personen'],
            ['import', 'Import'],
            ['sessions', 'Sessions'],
            ['settings', 'Einstellungen'],
          ] as Array<[Tab, string]>
        ).map(([id, label]) => (
          <button key={id} class={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
