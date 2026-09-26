import { useState } from 'preact/hooks'
import { newWorkshop, type AppData } from '../data/model'
import { formatDate } from '../data/format'
import type { Store } from '../data/store'

export function WorkshopsView({ store, data }: { store: Store; data: AppData }) {
  const [title, setTitle] = useState('')

  const add = () => {
    const t = title.trim()
    if (!t) return
    const ws = newWorkshop(t)
    store.update(d => {
      d.workshops.unshift(ws)
      d.activeWorkshopId = ws.id
    })
    setTitle('')
  }

  return (
    <div>
      <h2>Workshops</h2>
      <div class="card">
        <label class="field">
          <span>Neuer Workshop</span>
          <input value={title} onInput={e => setTitle((e.target as HTMLInputElement).value)} placeholder="z. B. Rhetorik Grundlagen, Gruppe A" onKeyDown={e => e.key === 'Enter' && add()} />
        </label>
        <button class="btn primary" onClick={add} disabled={!title.trim()}>
          Anlegen
        </button>
      </div>
      {data.workshops.length === 0 && <p class="dim">Noch kein Workshop. Lege oben einen an, danach kannst du Teilnehmende eintragen.</p>}
      <ul class="list">
        {data.workshops.map(ws => (
          <li key={ws.id} class={ws.id === data.activeWorkshopId ? 'active' : ''}>
            <div class="row between">
              <div class="grow" onClick={() => store.update(d => void (d.activeWorkshopId = ws.id))}>
                <div>{ws.title}</div>
                <div class="small dim">
                  {formatDate(ws.date)} · {ws.participants.length} Teilnehmende · {ws.sessions.length} Sessions
                </div>
              </div>
              {ws.id === data.activeWorkshopId ? <span class="small">aktiv</span> : (
                <button class="btn small" onClick={() => store.update(d => void (d.activeWorkshopId = ws.id))}>
                  wählen
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
