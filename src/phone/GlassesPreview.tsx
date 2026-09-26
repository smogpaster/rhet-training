import { useEffect, useState } from 'preact/hooks'
import type { MockHost, MockPage } from '../glasses/mockHost'

const SCALE_W = 576
const SCALE_H = 288
const BRIGHTNESS = ['#1f4a22', '#2a7a2f', '#35a63a', '#3ad341', '#3cfa44']

/** Nachbildung des Brillen-Displays für den Desktop-Browser (nur ohne Even-App sichtbar). */
export function GlassesPreview({ host }: { host: MockHost }) {
  const [page, setPage] = useState<MockPage | null>(host.page)
  const [exited, setExited] = useState(false)
  useEffect(
    () =>
      host.onPageChange(p => {
        setPage(p)
        setExited(host.exitRequested)
      }),
    [host],
  )
  const pct = (v: number, total: number) => `${(v / total) * 100}%`
  return (
    <div class="preview">
      <div class="row between small dim">
        <span>Brillen-Vorschau (kein Even-Host erkannt)</span>
        {exited && <span class="danger">App-Ende angefordert</span>}
      </div>
      <div class="screen">
        {page?.texts.map(t => (
          <div
            key={t.id}
            class="ctext"
            style={{ left: pct(t.x, SCALE_W), top: pct(t.y, SCALE_H), width: pct(t.w, SCALE_W), height: pct(t.h, SCALE_H), color: BRIGHTNESS[t.textColor ?? 4] }}
          >
            {t.content}
          </div>
        ))}
        {page?.lists.map(l => (
          <div key={l.id} class="clist" style={{ left: pct(l.x, SCALE_W), top: pct(l.y, SCALE_H), width: pct(l.w, SCALE_W), height: pct(l.h, SCALE_H) }}>
            {l.items.map((item, i) => (
              <div key={i} class={i === page.selected ? 'sel' : ''}>
                {item}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div class="controls">
        <button onClick={() => host.input('up')}>▲ hoch</button>
        <button onClick={() => host.input('down')}>▼ runter</button>
        <button onClick={() => host.input('click')}>● Tipp</button>
        <button onClick={() => host.input('double_click')}>●● Doppeltipp</button>
        <button onClick={() => host.input('long_press')}>lang drücken</button>
        {page?.menu.map(m => (
          <button key={m.id} onClick={() => host.menuClick(m.id)}>
            Menü: {m.label}
          </button>
        ))}
      </div>
    </div>
  )
}
