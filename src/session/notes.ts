// Marker und Notizen direkt an einer Person (außerhalb einer Rede-Session).
import { newId, type PersonNote } from '../data/model'
import type { Store } from '../data/store'

function editWs(store: Store, workshopId: string, fn: (notes: PersonNote[]) => PersonNote[] | void) {
  store.update(d => {
    const ws = d.workshops.find(w => w.id === workshopId)
    if (!ws) return
    const res = fn(ws.notes)
    if (res) ws.notes = res
  })
}

export function addPersonNote(store: Store, workshopId: string, participantId: string, kind: PersonNote['kind'], extra: Partial<PersonNote> = {}, now = Date.now()): PersonNote {
  const note: PersonNote = { id: newId(), participantId, at: new Date(now).toISOString(), kind, ...extra }
  editWs(store, workshopId, notes => void notes.push(note))
  return note
}

export function updatePersonNote(store: Store, workshopId: string, noteId: string, patch: Partial<PersonNote>) {
  editWs(store, workshopId, notes => {
    const n = notes.find(x => x.id === noteId)
    if (n) Object.assign(n, patch)
  })
}

export function removePersonNote(store: Store, workshopId: string, noteId: string) {
  editWs(store, workshopId, notes => notes.filter(n => n.id !== noteId))
}

/** Schlüssel einer Sprachnotiz in der Audio-Ablage (getrennt von Session-Aufnahmen). */
export const noteAudioKey = (noteId: string) => `note:${noteId}`
