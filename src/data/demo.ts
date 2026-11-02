import { emptyProfile, newGroup, newParticipant, newWorkshop, type AppData, type Profile } from './model'

/** Fiktive Beispieldaten zum Ausprobieren (Aufruf der App mit `?demo`). Keine echten Personen. */
export function seedDemo(d: AppData): void {
  if (d.workshops.length > 0) return
  const ws = newWorkshop('Demo: Verkaufsgespräche')
  ws.layout = { kind: 'u', rows: 4, cols: 5 }
  const ad = newGroup('Außendienst', 0)
  const id = newGroup('Innendienst', 1)
  const neu = newGroup('Neu im Vertrieb', 3)
  ws.groups.push(ad, id, neu)
  ws.intro.question = 'Was ist Ihr bester Türöffner bei Neukunden?'
  ws.intro.overview = 'Gemischte Gruppe: viel Außendienst-Erfahrung, dazu Innendienst und eine neue Kollegin.'
  ws.intro.expectations = ['Mehr Sicherheit bei Einwänden', 'Kein Schema F']
  const p = (name: string, row: number, col: number, groupId: string, order: number, profile: Partial<Profile>, extra: Record<string, unknown> = {}) => ({
    ...newParticipant(name, '', { row, col }),
    groupId,
    introOrder: order,
    profile: { ...emptyProfile(), ...profile },
    ...extra,
  })
  ws.participants.push(
    p('Lena Hartmann', 1, 1, ad.id, 1, { role: 'Außendienst Süd', experience: '12 Jahre', area: 'Bayern', answer: 'Fragt zuerst nach dem letzten Ärger mit der Anlage.', board: 'nach Problemen fragen', tip: 'Gutes Beispiel für Bedarfsermittlung.' }),
    p('Jonas Weber', 2, 1, ad.id, 2, { role: 'Außendienst Nord', experience: '3 Jahre', area: 'Hamburg', answer: 'Authentisch bleiben, kein Schema F.', board: 'authentisch bleiben' }, { nameCheck: 'Transkript „Jonas Weber“, Plan „Jonah Weber“', nameOptions: ['Jonas Weber', 'Jonah Weber'] }),
    p('Jonas Krüger', 3, 1, neu.id, 3, { role: 'neu seit Oktober', experience: 'noch keine Vertriebserfahrung', answer: 'Erst den Kunden kennenlernen.', board: 'Kunden kennenlernen', tip: 'Erste Runde eher als Beobachter.' }),
    p('Mira Schulz', 4, 2, id.id, 4, { role: 'Vertriebsinnendienst', experience: '1 Jahr', answer: 'Das Gefühl, dass wirklich zugehört wird.', board: 'Zuhören' }),
    p('Deniz Aydın', 4, 3, ad.id, 5, { role: 'Key Account', experience: '16 Jahre', area: 'NRW', answer: 'Hängt vom Kanal ab: Telefon, E-Mail oder vor Ort.', board: 'kanalabhängig' }),
    p('Paul Neumann', 4, 4, id.id, 6, { role: 'Leiter Innendienst', experience: 'kein Außendienst', answer: 'Jedes Gespräch hat einen Anlass.' }),
    p('Sophie Lang', 2, 5, ad.id, 7, { role: 'Außendienst Mitte', experience: '5 Jahre', area: 'Hessen', answer: 'An ein Problem mit dem Wettbewerber anknüpfen.', board: 'an Probleme anknüpfen' }, { seatCheck: 'Auf dem Plan unleserlich, Platz aus der Reihenfolge geschlossen' }),
    p('Tim Berger', 1, 5, ad.id, 8, { role: 'Außendienst West', experience: '8 Jahre', answer: 'Hat aktuell keinen festen Türöffner und erhofft sich heute einen.' }),
  )
  d.workshops.push(ws)
  d.activeWorkshopId = ws.id
}
