import type { AppData, Workshop } from '../data/model'
import type { Store } from '../data/store'

export function SettingsView({ store, data, ws }: { store: Store; data: AppData; ws: Workshop | null }) {
  const deleteWorkshop = () => {
    if (!ws) return
    if (!confirm(`Workshop „${ws.title}“ mit allen Teilnehmenden, Sessions und Markern endgültig löschen?`)) return
    store.update(d => {
      d.workshops = d.workshops.filter(w => w.id !== ws.id)
      d.activeWorkshopId = d.workshops[0]?.id ?? null
    })
  }

  return (
    <div>
      <h2>Einstellungen</h2>
      <h3>Datenschutz</h3>
      <div class="card">
        <p class="small">Alle Daten liegen nur lokal in der Even-App auf diesem iPhone. Es gibt keinen Server und keine Konten.</p>
        <label class="row">
          <input type="checkbox" style={{ width: 'auto' }} checked={data.settings.autoDeleteAudio} onChange={e => store.update(d => void (d.settings.autoDeleteAudio = (e.target as HTMLInputElement).checked))} />
          <span>Audioaufnahmen nach der Transkription automatisch löschen</span>
        </label>
        <p class="small dim">Die Aufnahme selbst kommt in Meilenstein 4. Der Schalter gilt dann sofort.</p>
      </div>
      <h3>Aktueller Workshop</h3>
      <div class="card">
        {ws ? (
          <div>
            <p>
              {ws.title} · {ws.participants.length} Teilnehmende · {ws.sessions.length} Sessions
            </p>
            <button class="btn danger" onClick={deleteWorkshop}>
              Alle Daten dieses Workshops löschen
            </button>
          </div>
        ) : (
          <p class="dim">Kein Workshop gewählt.</p>
        )}
      </div>
    </div>
  )
}
