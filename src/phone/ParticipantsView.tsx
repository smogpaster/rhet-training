import { useState } from 'preact/hooks'
import { parseParticipantsCsv } from '../data/csv'
import { newParticipant, type Participant, type Seat, type Workshop } from '../data/model'
import { seatLabel } from '../data/seats'
import type { Store } from '../data/store'
import { SeatPlan } from './SeatPlan'

export function ParticipantsView({ store, ws }: { store: Store; ws: Workshop | null }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [seat, setSeat] = useState<Seat | null>(null)
  const [csv, setCsv] = useState('')
  const [csvErrors, setCsvErrors] = useState<string[]>([])
  const [showCsv, setShowCsv] = useState(false)

  if (!ws) return <p class="dim">Bitte zuerst unter „Workshops“ einen Workshop anlegen oder auswählen.</p>

  const updateWs = (fn: (w: Workshop) => void) =>
    store.update(d => {
      const w = d.workshops.find(x => x.id === ws.id)
      if (w) fn(w)
    })

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setNote('')
    setSeat(null)
  }

  const startEdit = (p: Participant) => {
    setEditingId(p.id)
    setName(p.name)
    setNote(p.note)
    setSeat(p.seat)
  }

  const save = () => {
    const n = name.trim()
    if (!n) return
    updateWs(w => {
      // Ein Platz gehört nur einer Person: bisherige Belegung lösen.
      if (seat) for (const o of w.participants) if (o.id !== editingId && o.seat && o.seat.row === seat.row && o.seat.col === seat.col) o.seat = null
      if (editingId) {
        const p = w.participants.find(x => x.id === editingId)
        if (p) Object.assign(p, { name: n, note: note.trim(), seat })
      } else w.participants.push(newParticipant(n, note, seat))
    })
    resetForm()
  }

  const remove = (p: Participant) => {
    if (!confirm(`${p.name} wirklich löschen? Die zugehörigen Sessions bleiben erhalten.`)) return
    updateWs(w => void (w.participants = w.participants.filter(x => x.id !== p.id)))
    if (editingId === p.id) resetForm()
  }

  const importCsv = () => {
    const r = parseParticipantsCsv(csv)
    setCsvErrors(r.errors)
    if (r.participants.length) {
      updateWs(w => void w.participants.push(...r.participants))
      setCsv('')
      if (r.errors.length === 0) setShowCsv(false)
    }
  }

  const onFile = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) setCsv(await file.text())
  }

  const setLayout = (patch: Partial<Workshop['layout']>) => updateWs(w => Object.assign(w.layout, patch))

  return (
    <div>
      <h2>{ws.title}</h2>

      <h3>Sitzplan</h3>
      <div class="card">
        <div class="row wrap">
          <label class="field grow">
            <span>Form</span>
            <select value={ws.layout.kind} onChange={e => setLayout({ kind: (e.target as HTMLSelectElement).value as 'grid' | 'u' })}>
              <option value="grid">Raster (Reihen)</option>
              <option value="u">U-Form</option>
            </select>
          </label>
          <label class="field">
            <span>Reihen</span>
            <input type="number" min={1} max={8} value={ws.layout.rows} onChange={e => setLayout({ rows: Math.max(1, Math.min(8, Number((e.target as HTMLInputElement).value) || 1)) })} />
          </label>
          <label class="field">
            <span>Plätze je Reihe</span>
            <input type="number" min={1} max={10} value={ws.layout.cols} onChange={e => setLayout({ cols: Math.max(1, Math.min(10, Number((e.target as HTMLInputElement).value) || 1)) })} />
          </label>
        </div>
        <SeatPlan layout={ws.layout} participants={ws.participants} selected={seat} onPick={s => setSeat(s)} />
        <p class="small dim">Tippe auf einen Platz, um ihn der Person im Formular unten zuzuweisen.</p>
      </div>

      <h3>{editingId ? 'Person bearbeiten' : 'Person hinzufügen'}</h3>
      <div class="card">
        <label class="field">
          <span>Name</span>
          <input value={name} onInput={e => setName((e.target as HTMLInputElement).value)} placeholder="Vor- und Nachname" />
        </label>
        <label class="field">
          <span>Notiz</span>
          <input value={note} onInput={e => setNote((e.target as HTMLInputElement).value)} placeholder="z. B. will an Stimme arbeiten" />
        </label>
        <div class="row between">
          <span class="small dim">Platz: {seatLabel(ws.layout, seat)}</span>
          {seat && (
            <button class="btn small" onClick={() => setSeat(null)}>
              Platz entfernen
            </button>
          )}
        </div>
        <div class="row" style={{ marginTop: 10 }}>
          <button class="btn primary" onClick={save} disabled={!name.trim()}>
            {editingId ? 'Speichern' : 'Hinzufügen'}
          </button>
          {editingId && (
            <button class="btn" onClick={resetForm}>
              Abbrechen
            </button>
          )}
        </div>
      </div>

      <h3>Teilnehmende ({ws.participants.length})</h3>
      {ws.participants.length === 0 && <p class="dim">Noch niemand eingetragen.</p>}
      <ul class="list">
        {ws.participants.map(p => (
          <li key={p.id}>
            <div class="row between">
              <div class="grow" onClick={() => startEdit(p)}>
                <div>{p.name}</div>
                <div class="small dim">
                  {seatLabel(ws.layout, p.seat)}
                  {p.note ? ` · ${p.note}` : ''}
                </div>
              </div>
              <button class="btn small" onClick={() => startEdit(p)}>
                ändern
              </button>
              <button class="btn small danger" onClick={() => remove(p)}>
                löschen
              </button>
            </div>
          </li>
        ))}
      </ul>

      <h3>CSV-Import</h3>
      <div class="card">
        {!showCsv ? (
          <button class="btn" onClick={() => setShowCsv(true)}>
            Aus CSV importieren
          </button>
        ) : (
          <div>
            <p class="small dim">
              Eine Zeile je Person: <code>Name;Sitzplatz;Notiz</code>. Sitzplatz als Reihe/Platz, z. B. <code>2/3</code>. Kopfzeile ist optional.
            </p>
            <input type="file" accept=".csv,text/csv,text/plain" onChange={onFile} />
            <textarea rows={6} value={csv} onInput={e => setCsv((e.target as HTMLTextAreaElement).value)} placeholder={'Anna Müller;2/3;will an Stimme arbeiten\nBen Schulz;1/1;'} style={{ marginTop: 8 }} />
            {csvErrors.map((err, i) => (
              <div key={i} class="err">
                {err}
              </div>
            ))}
            <div class="row" style={{ marginTop: 8 }}>
              <button class="btn primary" onClick={importCsv} disabled={!csv.trim()}>
                Importieren
              </button>
              <button class="btn" onClick={() => setShowCsv(false)}>
                Schließen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
