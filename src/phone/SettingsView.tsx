import { useState } from 'preact/hooks'
import type { AppData, Workshop } from '../data/model'
import type { Store } from '../data/store'
import { audioStore } from '../session/audioStore'
import { noteAudioKey } from '../session/notes'

export function SettingsView({ store, data, ws }: { store: Store; data: AppData; ws: Workshop | null }) {
  const deleteWorkshop = () => {
    if (!ws) return
    if (!confirm(`Workshop „${ws.title}“ mit allen Teilnehmenden, Profilen, Sessions, Markern, Notizen und Aufnahmen endgültig löschen?`)) return
    void audioStore.removeMany([...ws.sessions.map(s => s.id), ...ws.notes.map(n => noteAudioKey(n.id))])
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
      <h3>Eigene API-Schlüssel</h3>
      <div class="card">
        <p class="small">
          Die App nutzt deine eigenen Schlüssel. Sie bleiben nur auf diesem Gerät und erscheinen in keinem Export. Ohne Schlüssel funktioniert alles bis auf die automatische Auswertung und die
          Spracherkennung.
        </p>
        <KeyField
          label="Claude (Anthropic) – Auswertung der Vorstellungsrunde"
          hint="Schlüssel beginnt mit sk-ant-. Erstellen unter platform.claude.com → API Keys."
          value={data.settings.claudeApiKey}
          onSave={v => store.update(d => void (d.settings.claudeApiKey = v))}
        />
        <KeyField
          label="OpenAI – Spracherkennung (Sessions, Sprachnotizen, Vorstellungsrunde)"
          hint="Schlüssel beginnt mit sk-. Erstellen unter platform.openai.com → API keys."
          value={data.settings.openaiApiKey}
          onSave={v => store.update(d => void (d.settings.openaiApiKey = v))}
        />
        <p class="small dim">
          Was gesendet wird: an Claude Transkript, Sitzplan-Foto und Stichworte der Vorstellungsrunde; an OpenAI die jeweilige Aufnahme. Beide Anbieter sitzen in den USA, bieten einen Vertrag zur
          Auftragsverarbeitung an und nutzen API-Daten nicht zum Training.
        </p>
        <label class="row">
          <input type="checkbox" style={{ width: 'auto' }} checked={data.settings.keepIntroTranscript} onChange={e => store.update(d => void (d.settings.keepIntroTranscript = (e.target as HTMLInputElement).checked))} />
          <span>Transkript der Vorstellungsrunde nach dem Übernehmen behalten</span>
        </label>
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

function KeyField({ label, hint, value, onSave }: { label: string; hint: string; value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState('')
  const masked = value ? `${value.slice(0, 7)}…${value.slice(-4)}` : 'nicht hinterlegt'
  return (
    <div class="field">
      <span class="small dim">{label}</span>
      <div class="small">Gespeichert: {masked}</div>
      <div class="row" style={{ marginTop: 4 }}>
        <input class="grow" type="password" autocomplete="off" value={draft} onInput={e => setDraft((e.target as HTMLInputElement).value)} placeholder="Schlüssel einfügen" />
        <button class="btn small" disabled={!draft.trim()} onClick={() => { onSave(draft.trim()); setDraft('') }}>
          Speichern
        </button>
        {value && (
          <button class="btn small danger" onClick={() => onSave('')}>
            Entfernen
          </button>
        )}
      </div>
      <div class="small dim">{hint}</div>
    </div>
  )
}
