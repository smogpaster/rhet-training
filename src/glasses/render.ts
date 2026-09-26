import {
  CreateStartUpPageContainer,
  ListContainerProperty,
  ListItemContainerProperty,
  MenuContainerProperty,
  MenuItemProperty,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import type { GlassesHost } from './host'
import { LIST_ITEM_MAX_CHARS, LIST_MAX_ITEMS, SCREEN_H, SCREEN_W, TEXT_LIMIT_CREATE, TEXT_LIMIT_UPGRADE, clip, type ListSpec, type PageSpec, type TextSpec } from './page'

const CALL_TIMEOUT_MS = 6000

function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label}: keine Antwort von der Brille`)), CALL_TIMEOUT_MS)),
  ])
}

function toText(t: TextSpec): TextContainerProperty {
  return new TextContainerProperty({
    xPosition: t.x ?? 0,
    yPosition: t.y ?? 0,
    width: t.w ?? SCREEN_W,
    height: t.h ?? SCREEN_H,
    borderWidth: t.border ?? 0,
    borderColor: 0,
    paddingLength: t.padding ?? 8,
    containerID: t.id,
    containerName: t.name,
    content: clip(t.content, TEXT_LIMIT_CREATE) || ' ',
    isEventCapture: t.capture ? 1 : 0,
    ...(t.textColor !== undefined ? { textColor: t.textColor } : {}),
  })
}

function toList(l: ListSpec): ListContainerProperty {
  const items = l.items.slice(0, LIST_MAX_ITEMS).map(i => clip(i, LIST_ITEM_MAX_CHARS) || ' ')
  return new ListContainerProperty({
    xPosition: l.x ?? 0,
    yPosition: l.y ?? 0,
    width: l.w ?? SCREEN_W,
    height: l.h ?? SCREEN_H,
    borderWidth: 0,
    borderColor: 0,
    paddingLength: 0,
    containerID: l.id,
    containerName: l.name,
    isEventCapture: l.capture ? 1 : 0,
    itemContainer: new ListItemContainerProperty({
      itemCount: items.length,
      itemWidth: 0,
      isItemSelectBorderEn: 1,
      itemName: items,
    }),
  })
}

function toPage(spec: PageSpec) {
  const textObject = (spec.texts ?? []).map(toText)
  const listObject = (spec.lists ?? []).map(toList)
  const menuObject = spec.menu?.length
    ? new MenuContainerProperty({ menuItems: spec.menu.map(m => new MenuItemProperty({ itemID: m.id, itemName: m.label })) })
    : undefined
  return { containerTotalNum: textObject.length + listObject.length, textObject, listObject, menuObject }
}

/**
 * Serialisiert alle Bridge-Aufrufe (nie parallel senden, siehe Doku) und
 * entscheidet zwischen Startseite (einmalig) und Neuaufbau.
 */
export class Renderer {
  private queue: Promise<unknown> = Promise.resolve()
  private started = false
  private lastText = new Map<number, string>()

  constructor(private host: GlassesHost) {}

  private enqueue<T>(job: () => Promise<T>): Promise<T | undefined> {
    const run = this.queue.then(job).catch(err => {
      console.warn('Brille:', err instanceof Error ? err.message : JSON.stringify(err))
      return undefined
    })
    this.queue = run
    return run
  }

  /** Zeigt eine komplette Seite (beim ersten Mal als Startseite). */
  showPage(spec: PageSpec): Promise<unknown> {
    return this.enqueue(async () => {
      const page = toPage(spec)
      this.lastText.clear()
      for (const t of spec.texts ?? []) this.lastText.set(t.id, t.content)
      if (!this.started) {
        const result = await withTimeout(this.host.createStartUpPageContainer(new CreateStartUpPageContainer(page)), 'Startseite')
        if (result !== 0) throw new Error(`Startseite fehlgeschlagen (Code ${result})`)
        this.started = true
        return result
      }
      return withTimeout(this.host.rebuildPageContainer(new RebuildPageContainer(page)), 'Seitenaufbau')
    })
  }

  /** Flackerfreies Textupdate. Unveränderter Inhalt wird nicht gesendet. */
  updateText(id: number, name: string, content: string, textColor?: number): Promise<unknown> {
    return this.enqueue(async () => {
      const clipped = clip(content, TEXT_LIMIT_UPGRADE) || ' '
      if (this.lastText.get(id) === clipped && textColor === undefined) return true
      this.lastText.set(id, clipped)
      return withTimeout(
        this.host.textContainerUpgrade(
          new TextContainerUpgrade({
            containerID: id,
            containerName: name,
            content: clipped,
            contentOffset: 0,
            contentLength: 0,
            ...(textColor !== undefined ? { textColor } : {}),
          }),
        ),
        'Textupdate',
      )
    })
  }

  /** Systemdialog zum Beenden (Modus 1) bzw. sofort beenden (Modus 0). */
  shutDown(mode: 0 | 1 = 1): Promise<unknown> {
    return this.enqueue(() => withTimeout(this.host.shutDownPageContainer(mode), 'Beenden'))
  }
}
