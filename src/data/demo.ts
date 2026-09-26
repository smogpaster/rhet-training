import { newParticipant, newWorkshop, type AppData } from './model'

/** Beispieldaten zum schnellen Ausprobieren (Aufruf der App mit `?demo`). */
export function seedDemo(d: AppData): void {
  if (d.workshops.length > 0) return
  const ws = newWorkshop('Demo-Workshop')
  ws.layout = { kind: 'u', rows: 3, cols: 4 }
  ws.participants.push(
    newParticipant('Anna Müller', 'will an Stimme arbeiten', { row: 1, col: 1 }),
    newParticipant('Ben Schulz', 'spricht sehr schnell', { row: 2, col: 1 }),
    newParticipant('Clara Meier', 'mehr Blickkontakt', { row: 3, col: 2 }),
    newParticipant('Dora Öztürk', '', { row: 3, col: 3 }),
    newParticipant('Emil Weiß', 'Füllwörter („äh“)', { row: 1, col: 4 }),
  )
  d.workshops.push(ws)
  d.activeWorkshopId = ws.id
}
