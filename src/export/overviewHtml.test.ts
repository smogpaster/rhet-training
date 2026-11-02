import { describe, expect, it } from 'vitest'
import { emptyData } from '../data/model'
import { seedDemo } from '../data/demo'
import { overviewFileName, workshopToHtml } from './overviewHtml'

describe('workshop overview export', () => {
  it('renders plan, groups, profiles and escapes content', () => {
    const d = emptyData()
    seedDemo(d)
    const ws = d.workshops[0]
    ws.participants[0].note = '<script>alert(1)</script>'
    ws.notes.push({ id: 'n1', participantId: ws.participants[0].id, at: '2026-11-02T10:00:00Z', kind: 'notiz', text: 'Stimme kräftig' })
    const html = workshopToHtml(ws, new Date('2026-11-02T12:00:00Z'))
    expect(html).toContain('<h1>Demo: Verkaufsgespräche</h1>')
    expect(html).toContain('Lena Hartmann')
    expect(html).toContain('nach Problemen fragen')
    expect(html).toContain('Stimme kräftig')
    expect(html).toContain('Transkript „Jonas Weber“')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>alert(1)')
    expect(html).not.toMatch(/https?:\/\/(?!www\.w3)/) // keine externen Ressourcen
    expect(html).not.toContain('sk-')
    expect(overviewFileName(ws)).toMatch(/^teilnehmende-demo-verkaufsgespraeche-\d{4}-\d{2}-\d{2}\.html$/)
  })
})
