import { useState } from 'preact/hooks'
import { parseParticipantsCsv } from '../data/csv'
import { formatDateTime } from '../data/format'
import { emptyProfile, newGroup, newParticipant, type Participant, type Profile, type Seat, type Workshop } from '../data/model'
import { navigationOrder, personTimeline, shortNames } from '../data/people'
import { seatLabel } from '../data/seats'
import type { Store } from '../data/store'
import { audioStore } from '../session/audioStore'
import { noteAudioKey, removePersonNote } from '../session/notes'
import { SeatPlan } from './SeatPlan'

const PROFILE_FIELDS: Array<[keyof Profile, string, boolean]> = [
  ['role', 'Funktion', false],
  ['experience', 'Erfahrung', false],
  ['area', 'Gebiet', false],
  ['background', 'Hintergrund', true],
  ['answer', 'Antwort auf die Einstiegsfrage', true],
  ['board', 'Tafel-Stichwort (eine Zeile, erscheint auf der Brille)', false],
  ['tip', 'Hinweis für den Seminartag', true],
]

interface Draft {
  id: string | null
  name: string
  shortName: string
  note: string
  seat: Seat | null
  groupId: string | null
  introOrder: string
  profile: Profile
}

const emptyDraft = (): Draft => ({ id: null, name: '', shortName: '', note: '', seat: null, groupId: null, introOrder: '', profile: emptyProfile() })

export function ParticipantsView({ store, ws }: { store: Store; ws: Workshop | null }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [csv, setCsv] = useState('')
  const [csvErrors, setCsvErrors] = useState<string[]>([])
  const [showCsv, setShowCsv] = useState(false)
  const [newGroupLabel, setNewGroupLabel] = useState('')
  const [filter, setFilter] = useState<string | null>(null)

  if (!ws) return <p class="dim">Bitte zuerst unter „Workshops“ einen Workshop anlegen oder auswählen.</p>

  const updateWs = (fn: (w: Workshop) => void) =>
    store.update(d => {
      const w = d.workshops.find(x => x.id === ws.id)
      if (w) fn(w)
    })
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(d => ({ ...d, [k]: v }))
  const setProfile = (k: keyof Profile, v: string) => setDraft(d => ({ ...d, profile: { ...d.profile, [k]: v } }))

  const startEdit = (p: Participant) => {
    setDraft({
      id: p.id,
      name: p.name,
      shortName: p.shortName ?? '',
      note: p.note,
      seat: p.seat,
      groupId: p.groupId ?? null,
      introOrder: p.introOrder ? String(p.introOrder) : '',
      profile: { ...emptyProfile(), ...(p.profile ?? {}) },
    })
    setTimeout(() => document.getElementById('person-form')?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const save = () => {
    const n = draft.name.trim()
    if (!n) return
    const order = Number(draft.introOrder)
    updateWs(w => {
      // Ein Platz gehört nur einer Person: bisherige Belegung lösen.
      const seat = draft.seat
      if (seat) for (const o of w.participants) if (o.id !== draft.id && o.seat && o.seat.row === seat.row && o.seat.col === seat.col) o.seat = null
      const fields = {
        name: n,
        shortName: draft.shortName.trim() || undefined,
        note: draft.note.trim(),
        seat,
        groupId: draft.groupId,
        introOrder: Number.isInteger(order) && order > 0 ? order : null,
        profile: draft.profile,
      }
      const p = draft.id ? w.participants.find(x => x.id === draft.id) : null
      if (p) Object.assign(p, fields)
      else w.participants.push({ ...newParticipant(n), ...fields })
    })
    setDraft(emptyDraft())
  }

  const resolve = (p: Participant, field: 'nameCheck' | 'seatCheck', name?: string) =>
    updateWs(w => {
      const x = w.participants.find(y => y.id === p.id)
      if (!x) return
      if (name) x.name = name
      x[field] = undefined
      if (field === 'nameCheck') x.nameOptions = undefined
    })

  const remove = (p: Participant) => {
    if (!confirm(`${p.name} wirklich löschen? Sessions bleiben erhalten, Notizen zu dieser Person werden gelöscht.`)) return
    const noteIds = ws.notes.filter(n => n.participantId === p.id).map(n => noteAudioKey(n.id))
    void audioStore.removeMany(noteIds)
    updateWs(w => {
      w.participants = w.participants.filter(x => x.id !== p.id)
      w.notes = w.notes.filter(x => x.participantId !== p.id)
    })
    if (draft.id === p.id) setDraft(emptyDraft())
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
  const short = shortNames(ws.participants)
  const ordered = navigationOrder(ws)
  const visible = filter ? ordered.filter(p => p.groupId === filter) : ordered
  const checks = ws.participants.filter(p => p.nameCheck || p.seatCheck)
  const editing = draft.id ? ws.participants.find(p => p.id === draft.id) : null

  return (
    <div>
      <h2>{ws.title}</h2>

      {checks.length > 0 && (
        <div class="notice">
          <strong>{checks.length} Hinweis{checks.length > 1 ? 'e' : ''} prüfen</strong>
          <ul class="list">
            {checks.map(p => (
              <li key={p.id}>
                <div>{p.name}</div>
                {p.nameCheck && (
                  <div class="row wrap small">
                    <span class="grow">Name: {p.nameCheck}</span>
                    {(p.nameOptions ?? [])
                      .filter(v => v !== p.name)
                      .map(v => (
                        <button key={v} class="btn small" onClick={() => resolve(p, 'nameCheck', v)}>
                          „{v}“ nehmen
                        </button>
                      ))}
                    <button class="btn small" onClick={() => resolve(p, 'nameCheck')}>
                      „{p.name}“ passt
                    </button>
                  </div>
                )}
                {p.seatCheck && (
                  <div class="row wrap small">
                    <span class="grow">Platz: {p.seatCheck}</span>
                    <button class="btn small" onClick={() => startEdit(p)}>
                      Platz ändern
                    </button>
                    <button class="btn small" onClick={() => resolve(p, 'seatCheck')}>
                      passt
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3>Sitzplan</h3>
      <div class="card">
        <div class="row wrap">
          <label class="field grow">
            <span>Form</span>
            <select value={ws.layout.kind} onChange={e => setLayout({ kind: (e.target as HTMLSelectElement).value as Workshop['layout']['kind'] })}>
              <option value="u">U-Form</option>
              <option value="grid">Reihen</option>
              <option value="tables">Tischgruppen</option>
            </select>
          </label>
          <label class="field">
            <span>{ws.layout.kind === 'tables' ? 'Tische' : ws.layout.kind === 'u' ? 'Tiefe' : 'Reihen'}</span>
            <input type="number" min={1} max={8} value={ws.layout.rows} onChange={e => setLayout({ rows: clampInt((e.target as HTMLInputElement).value, 1, 8) })} />
          </label>
          <label class="field">
            <span>{ws.layout.kind === 'tables' ? 'Plätze je Tisch' : ws.layout.kind === 'u' ? 'Breite' : 'Plätze je Reihe'}</span>
            <input type="number" min={1} max={10} value={ws.layout.cols} onChange={e => setLayout({ cols: clampInt((e.target as HTMLInputElement).value, 1, 10) })} />
          </label>
        </div>
        <SeatPlan layout={ws.layout} participants={ws.participants} groups={ws.groups} selected={draft.seat} onPick={s => set('seat', s)} />
        <p class="small dim">Tippe auf einen Platz, um ihn der Person im Formular zuzuweisen. Die Zahl am Platz ist die Reihenfolge in der Vorstellungsrunde.</p>
      </div>

      <h3>Personengruppen</h3>
      <div class="card">
        <div class="chips">
          {ws.groups.map(g => (
            <span key={g.id} class="chip">
              <span class="dot" style={{ background: g.color }} />
              {g.label} ({ws.participants.filter(p => p.groupId === g.id).length})
              <button
                class="btn small"
                style={{ marginLeft: 6, padding: '0 6px' }}
                onClick={() => updateWs(w => {
                  w.groups = w.groups.filter(x => x.id !== g.id)
                  for (const p of w.participants) if (p.groupId === g.id) p.groupId = null
                })}
                aria-label={`${g.label} entfernen`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div class="row">
          <input class="grow" value={newGroupLabel} onInput={e => setNewGroupLabel((e.target as HTMLInputElement).value)} placeholder="z. B. Außendienst" />
          <button
            class="btn"
            disabled={!newGroupLabel.trim()}
            onClick={() => {
              updateWs(w => void w.groups.push(newGroup(newGroupLabel, w.groups.length)))
              setNewGroupLabel('')
            }}
          >
            Hinzufügen
          </button>
        </div>
      </div>

      <h3 id="person-form">{draft.id ? 'Person bearbeiten' : 'Person hinzufügen'}</h3>
      <div class="card">
        <div class="row wrap">
          <label class="field grow">
            <span>Name</span>
            <input value={draft.name} onInput={e => set('name', (e.target as HTMLInputElement).value)} placeholder="Vor- und Nachname" />
          </label>
          <label class="field">
            <span>Kurzname (Brille)</span>
            <input value={draft.shortName} onInput={e => set('shortName', (e.target as HTMLInputElement).value)} placeholder={draft.id ? short.get(draft.id) : 'automatisch'} />
          </label>
        </div>
        <div class="row wrap">
          <label class="field grow">
            <span>Gruppe</span>
            <select value={draft.groupId ?? ''} onChange={e => set('groupId', (e.target as HTMLSelectElement).value || null)}>
              <option value="">–</option>
              {ws.groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label class="field">
            <span>Nr. in der Runde</span>
            <input type="number" min={1} value={draft.introOrder} onInput={e => set('introOrder', (e.target as HTMLInputElement).value)} />
          </label>
        </div>
        <div class="row between">
          <span class="small dim">Platz: {seatLabel(ws.layout, draft.seat)}</span>
          {draft.seat && (
            <button class="btn small" onClick={() => set('seat', null)}>
              Platz entfernen
            </button>
          )}
        </div>
        <details open={!!draft.id} style={{ marginTop: 10 }}>
          <summary>Profil aus der Vorstellungsrunde</summary>
          {PROFILE_FIELDS.map(([k, label, long]) => (
            <label key={k} class="field">
              <span>{label}</span>
              {long ? (
                <textarea class="small" rows={3} value={draft.profile[k]} onInput={e => setProfile(k, (e.target as HTMLTextAreaElement).value)} />
              ) : (
                <input value={draft.profile[k]} onInput={e => setProfile(k, (e.target as HTMLInputElement).value)} />
              )}
            </label>
          ))}
          {draft.profile.evidence && (
            <details>
              <summary>Belegstellen aus dem Transkript</summary>
              <p class="small dim" style={{ whiteSpace: 'pre-wrap' }}>
                {draft.profile.evidence}
              </p>
            </details>
          )}
        </details>
        <label class="field">
          <span>Meine Notizen</span>
          <textarea class="small" rows={2} value={draft.note} onInput={e => set('note', (e.target as HTMLTextAreaElement).value)} placeholder="z. B. DISC-Typ, Abwimmler-Karte, Feedback" />
        </label>
        <div class="row" style={{ marginTop: 10 }}>
          <button class="btn primary" onClick={save} disabled={!draft.name.trim()}>
            {draft.id ? 'Speichern' : 'Hinzufügen'}
          </button>
          {draft.id && (
            <button class="btn" onClick={() => setDraft(emptyDraft())}>
              Abbrechen
            </button>
          )}
        </div>
        {editing && <Timeline ws={ws} participant={editing} store={store} />}
      </div>

      <h3>Teilnehmende ({ws.participants.length})</h3>
      {ws.groups.length > 0 && (
        <div class="chips">
          <button class={`chip ${filter === null ? 'on' : ''}`} onClick={() => setFilter(null)}>
            Alle
          </button>
          {ws.groups.map(g => (
            <button key={g.id} class={`chip ${filter === g.id ? 'on' : ''}`} onClick={() => setFilter(g.id)}>
              <span class="dot" style={{ background: g.color }} />
              {g.label}
            </button>
          ))}
        </div>
      )}
      {ws.participants.length === 0 && <p class="dim">Noch niemand eingetragen. Nutze „Import“ für die Vorstellungsrunde oder trage Personen hier ein.</p>}
      <ul class="list">
        {visible.map(p => {
          const g = ws.groups.find(x => x.id === p.groupId)
          return (
            <li key={p.id}>
              <div class="row between">
                <div class="grow" onClick={() => startEdit(p)}>
                  <div>
                    {g && <span class="dot" style={{ background: g.color }} />}
                    {p.introOrder ? `${p.introOrder}. ` : ''}
                    {p.name}
                    {(p.nameCheck || p.seatCheck) && <span class="badge warn" style={{ marginLeft: 6 }}>prüfen</span>}
                  </div>
                  <div class="small dim">
                    {[p.profile?.role, seatLabel(ws.layout, p.seat), p.profile?.board ? `Tafel: ${p.profile.board}` : ''].filter(Boolean).join(' · ')}
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
          )
        })}
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

function Timeline({ ws, participant, store }: { ws: Workshop; participant: Participant; store: Store }) {
  const entries = personTimeline(ws, participant.id)
  if (entries.length === 0) return <p class="small dim" style={{ marginTop: 12 }}>Noch keine Marker oder Notizen.</p>
  return (
    <div style={{ marginTop: 12 }}>
      <h3>Marker und Notizen</h3>
      <ul class="list timeline">
        {entries.map(e => (
          <li key={e.id}>
            <div class="row between">
              <span>
                <strong>{e.label}</strong> <span class="dim small">{formatDateTime(e.at)}</span>
              </span>
              {e.source === 'note' && (
                <button
                  class="btn small danger"
                  onClick={() => {
                    if (!confirm('Eintrag löschen?')) return
                    void audioStore.remove(noteAudioKey(e.id))
                    removePersonNote(store, ws.id, e.id)
                  }}
                >
                  ×
                </button>
              )}
            </div>
            {e.text && <div class="small dim">{e.text}</div>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function clampInt(v: string, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(Number(v)) || min))
}
