import type { AppData, Workshop } from '../data/model'
import type { Store } from '../data/store'
import { audioStore } from '../session/audioStore'

export function SettingsView({ store, data, ws }: { store: Store; data: AppData; ws: Workshop | null }) {
  const deleteWorkshop = () => {
    if (!ws) return
    if (!confirm(`Workshop „${ws.title}“ mit allen Teilnehmenden, Sessions, Markern und Aufnahmen endgültig löschen?`)) return
    void audioStore.removeMany(ws.sessions.map(s => s.id))
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
        <p class="small dim">Aufnahmen liegen nur im Speicher der Even-App (IndexedDB) und werden nie exportiert.</p>
      </div>
      <h3>Transkription</h3>
      <div class="card">
        <p class="small">Dienst: <strong>noch nicht gewählt</strong>. Ohne Dienst werden Sessions mit Markern und Zeitstempeln gespeichert, aber ohne Transkript-Ausschnitte.</p>
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
