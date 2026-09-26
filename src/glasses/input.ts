// Normalisiert die Roh-Events des SDK zu einem kleinen, gut testbaren Eingabetyp.
import { EventSourceType, OsEventTypeList, type EvenHubEvent } from '@evenrealities/even_hub_sdk'

export type InputSource = 'ring' | 'glasses' | 'unknown'

export type GlassesInput =
  | { kind: 'tap'; source: InputSource }
  | { kind: 'double'; source: InputSource }
  | { kind: 'up'; source: InputSource }
  | { kind: 'down'; source: InputSource }
  | { kind: 'longPress'; source: InputSource }
  | { kind: 'longRelease'; source: InputSource }
  /** Einfachtipp auf einem Listencontainer: die Firmware liefert den gewählten Index. */
  | { kind: 'select'; index: number; name?: string; source: InputSource }
  | { kind: 'menu'; itemId: number; source: InputSource }
  | { kind: 'foreground'; source: InputSource }
  | { kind: 'background'; source: InputSource }
  | { kind: 'exit'; source: InputSource }

function sourceOf(raw?: EventSourceType): InputSource {
  if (raw === EventSourceType.TOUCH_EVENT_FROM_RING) return 'ring'
  if (raw === EventSourceType.TOUCH_EVENT_FROM_GLASSES_L || raw === EventSourceType.TOUCH_EVENT_FROM_GLASSES_R) return 'glasses'
  return 'unknown'
}

// CLICK_EVENT ist 0 und fehlt im Protobuf-Payload. Deshalb wird der Standardwert
// nur innerhalb eines vorhandenen Umschlags aufgelöst (siehe offizielle Templates).
function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT
}

/** Wandelt ein SDK-Event in eine GlassesInput um. Audio-Events liefern `null`. */
export function normalizeEvent(event: EvenHubEvent): GlassesInput | null {
  if (event.menuItemClickEvent?.itemID !== undefined) {
    return { kind: 'menu', itemId: event.menuItemClickEvent.itemID, source: 'unknown' }
  }
  if (event.listEvent) {
    const t = eventTypeOf(event.listEvent)
    if (t === OsEventTypeList.DOUBLE_CLICK_EVENT) return { kind: 'double', source: 'unknown' }
    return {
      kind: 'select',
      index: event.listEvent.currentSelectItemIndex ?? 0,
      name: event.listEvent.currentSelectItemName,
      source: 'unknown',
    }
  }
  if (event.textEvent) {
    const t = eventTypeOf(event.textEvent)
    if (t === OsEventTypeList.SCROLL_TOP_EVENT) return { kind: 'up', source: 'unknown' }
    if (t === OsEventTypeList.SCROLL_BOTTOM_EVENT) return { kind: 'down', source: 'unknown' }
    if (t === OsEventTypeList.DOUBLE_CLICK_EVENT) return { kind: 'double', source: 'unknown' }
    if (t === OsEventTypeList.CLICK_EVENT) return { kind: 'tap', source: 'unknown' }
    return null
  }
  const sys = event.sysEvent
  if (sys) {
    const source = sourceOf(sys.eventSource)
    switch (eventTypeOf(sys)) {
      case OsEventTypeList.CLICK_EVENT:
        return { kind: 'tap', source }
      case OsEventTypeList.DOUBLE_CLICK_EVENT:
        return { kind: 'double', source }
      case OsEventTypeList.SCROLL_TOP_EVENT:
        return { kind: 'up', source }
      case OsEventTypeList.SCROLL_BOTTOM_EVENT:
        return { kind: 'down', source }
      case OsEventTypeList.LONG_PRESS_EVENT:
        return { kind: 'longPress', source }
      case OsEventTypeList.LONG_PRESS_RELEASE_EVENT:
        return { kind: 'longRelease', source }
      case OsEventTypeList.FOREGROUND_ENTER_EVENT:
        return { kind: 'foreground', source }
      case OsEventTypeList.FOREGROUND_EXIT_EVENT:
        return { kind: 'background', source }
      case OsEventTypeList.SYSTEM_EXIT_EVENT:
      case OsEventTypeList.ABNORMAL_EXIT_EVENT:
        return { kind: 'exit', source }
      default:
        return null
    }
  }
  return null
}
