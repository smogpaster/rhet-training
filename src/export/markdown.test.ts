import { describe, expect, it } from 'vitest'
import { newParticipant, newWorkshop, type Session } from '../data/model'
import { exportFileName, sessionToMarkdown } from './markdown'

describe('markdown export', () => {
  it('lists markers with time and excerpt', () => {
    const ws = newWorkshop('Rhetorik')
    const p = newParticipant('Anna Müller', 'Stimme', { row: 2, col: 3 })
    const s: Session = {
      id: 's1',
      workshopId: ws.id,
      participantId: p.id,
      startedAt: '2026-09-26T09:00:00.000Z',
      durationSec: 134,
      status: 'ended',
      pausedSec: 0,
      pausedAt: null,
      audioDeleted: true,
      markers: [
        { id: 'm1', t: 62, kind: 'stark', excerpt: 'Das war ein starker Einstieg.' },
        { id: 'm2', t: 120, kind: 'besprechen' },
      ],
    }
    const md = sessionToMarkdown(ws, s, p)
    expect(md).toContain('# Feedback für Anna Müller')
    expect(md).toContain('Redezeit: 02:14')
    expect(md).toContain('### 01:02 · stark')
    expect(md).toContain('> Das war ein starker Einstieg.')
    expect(md).toContain('### 02:00 · besprechen')
    expect(md).toContain('Sitzplatz: Reihe 2, Platz 3')
    expect(exportFileName(p, s)).toBe('feedback-anna-mueller-2026-09-26.md')
  })
})
