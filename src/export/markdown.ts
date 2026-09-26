import { formatDateTime, mmss } from '../data/format'
import { MARKER_LABEL, type Participant, type Session, type Workshop } from '../data/model'
import { seatLabel } from '../data/seats'

/** Markdown-Export einer Session zum Weitergeben an die teilnehmende Person. */
export function sessionToMarkdown(ws: Workshop, session: Session, participant: Participant | null): string {
  const name = participant?.name ?? 'Unbekannt'
  const lines: string[] = []
  lines.push(`# Feedback für ${name}`)
  lines.push('')
  lines.push(`- Workshop: ${ws.title}`)
  lines.push(`- Datum: ${formatDateTime(session.startedAt)}`)
  lines.push(`- Redezeit: ${mmss(session.durationSec)}`)
  if (participant?.seat) lines.push(`- Sitzplatz: ${seatLabel(ws.layout, participant.seat)}`)
  if (participant?.note) lines.push(`- Notiz: ${participant.note}`)
  lines.push('')
  const stark = session.markers.filter(m => m.kind === 'stark')
  const besprechen = session.markers.filter(m => m.kind === 'besprechen')
  lines.push(`## Marker (${session.markers.length})`)
  lines.push('')
  lines.push(`${stark.length}× stark, ${besprechen.length}× besprechen`)
  lines.push('')
  if (session.markers.length === 0) lines.push('_Keine Marker gesetzt._')
  for (const m of session.markers) {
    lines.push(`### ${mmss(m.t)} · ${MARKER_LABEL[m.kind]}`)
    lines.push('')
    lines.push(m.excerpt ? `> ${m.excerpt.replace(/\n/g, '\n> ')}` : '_(kein Transkript-Ausschnitt)_')
    lines.push('')
  }
  if (session.transcript?.length) {
    lines.push('## Transkript')
    lines.push('')
    lines.push(session.transcript.map(w => w.w).join(' '))
    lines.push('')
  }
  return lines.join('\n')
}

/** Dateiname für den Export, z. B. feedback-anna-mueller-2026-09-26.md */
export function exportFileName(participant: Participant | null, session: Session): string {
  const slug = (participant?.name ?? 'unbekannt')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `feedback-${slug}-${session.startedAt.slice(0, 10)}.md`
}
