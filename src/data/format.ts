/** Sekunden als mm:ss, z. B. 134 → "02:14". */
export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

/** ISO-Zeitstempel als deutsches Datum mit Uhrzeit. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatDate(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
