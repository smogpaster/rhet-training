import { describe, expect, it } from 'vitest'
import { normalizeEvent } from './input'

describe('normalizeEvent', () => {
  it('treats a sysEvent without eventType as a tap', () => {
    expect(normalizeEvent({ sysEvent: { eventSource: 2 } as never })).toEqual({ kind: 'tap', source: 'ring' })
  })
  it('does not treat an audio-only event as a tap', () => {
    expect(normalizeEvent({ audioEvent: { audioPcm: new Uint8Array(2) } as never })).toBeNull()
  })
  it('maps double click, long press and scroll', () => {
    expect(normalizeEvent({ sysEvent: { eventType: 3, eventSource: 1 } as never })?.kind).toBe('double')
    expect(normalizeEvent({ sysEvent: { eventType: 9 } as never })?.kind).toBe('longPress')
    expect(normalizeEvent({ textEvent: { eventType: 1 } as never })?.kind).toBe('up')
    expect(normalizeEvent({ textEvent: { eventType: 2 } as never })?.kind).toBe('down')
  })
  it('maps list selection with missing index to 0', () => {
    expect(normalizeEvent({ listEvent: { containerID: 2 } as never })).toMatchObject({ kind: 'select', index: 0 })
  })
  it('maps menu clicks', () => {
    expect(normalizeEvent({ menuItemClickEvent: { itemID: 3 } as never })).toMatchObject({ kind: 'menu', itemId: 3 })
  })
})
