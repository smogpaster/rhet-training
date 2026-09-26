import { useState } from 'preact/hooks'
import type { Store } from '../data/store'
import type { MockHost } from '../glasses/mockHost'
import { GlassesPreview } from './GlassesPreview'
import { ParticipantsView } from './ParticipantsView'
import { SettingsView } from './SettingsView'
import { WorkshopsView } from './WorkshopsView'
import { useStore } from './useStore'

type Tab = 'workshops' | 'people' | 'sessions' | 'settings'

export function App({ store, mock }: { store: Store; mock: MockHost | null }) {
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
        {tab === 'sessions' && (
          <div>
            <h2>Sessions</h2>
            <p class="dim">Feedback-Marker und Rückblick kommen in Meilenstein 3.</p>
          </div>
        )}
        {tab === 'settings' && <SettingsView store={store} data={data} ws={ws} />}
      </main>
      <nav class="tabs">
        {(
          [
            ['workshops', 'Workshops'],
            ['people', 'Teilnehmende'],
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
