// Gesamtübersicht eines Workshops als eigenständige HTML-Seite (offline, ohne externe Schriften).
// Aufbau angelehnt an die Seminar-Übersicht der Trainerin: Sitzplan, Gruppe, Profile, Notizen.
import { formatDate, formatDateTime } from '../data/format'
import { isSeatCell } from '../data/seats'
import { navigationOrder, personTimeline } from '../data/people'
import type { Participant, Workshop } from '../data/model'
import { seatLabel } from '../data/seats'

const esc = (s: string | undefined | null) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function overviewFileName(ws: Workshop): string {
  const slug = ws.title
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `teilnehmende-${slug || 'workshop'}-${ws.date}.html`
}

export function workshopToHtml(ws: Workshop, now = new Date()): string {
  const people = navigationOrder(ws)
  const group = (p: Participant) => ws.groups.find(g => g.id === p.groupId)
  const color = (p: Participant) => group(p)?.color ?? '#9AAAB5'

  // Sitzplan
  const rowOrder = ws.layout.kind === 'tables' ? [...Array(ws.layout.rows)].map((_, i) => i + 1) : [...Array(ws.layout.rows)].map((_, i) => ws.layout.rows - i)
  const cells: string[] = []
  for (const row of rowOrder) {
    if (ws.layout.kind === 'tables') cells.push(`<div class="tlabel">Tisch ${row}</div>`)
    for (let col = 1; col <= ws.layout.cols; col++) {
      if (!isSeatCell(ws.layout, row, col)) {
        cells.push('<div></div>')
        continue
      }
      const p = ws.participants.find(x => x.seat?.row === row && x.seat?.col === col)
      cells.push(
        p
          ? `<a class="seat" href="#p-${esc(p.id)}" data-g="${esc(p.groupId ?? '')}" style="--c:${esc(color(p))}">${p.introOrder ? `<i>${p.introOrder}</i>` : ''}<b>${esc(p.name)}</b><span>${esc(group(p)?.label ?? p.profile?.role ?? '')}</span></a>`
          : '<div class="seat empty"></div>',
      )
    }
  }
  const gridCols = ws.layout.kind === 'tables' ? `5em repeat(${ws.layout.cols}, minmax(0,1fr))` : `repeat(${ws.layout.cols}, minmax(0,1fr))`
  const topLabel = ws.layout.kind === 'u' ? 'Stirnseite' : ws.layout.kind === 'grid' ? 'hinten' : ''
  const bottomLabel = ws.layout.kind === 'u' ? 'offene Seite · Trainer' : 'vorne · Trainer'

  const legend = ws.groups
    .map(g => `<button class="chip" data-f="${esc(g.id)}"><span class="dot" style="background:${esc(g.color)}"></span>${esc(g.label)} <small>${ws.participants.filter(p => p.groupId === g.id).length}</small></button>`)
    .join('')

  const openers = people
    .filter(p => p.profile?.board)
    .map(p => `<li><a href="#p-${esc(p.id)}">${esc(p.profile!.board)}</a> <small>(${esc(p.name)})</small></li>`)
    .join('')
  const expectations = ws.intro.expectations.map(e => `<li>${esc(e)}</li>`).join('')

  const cards = people
    .map(p => {
      const pr = p.profile
      const g = group(p)
      const timeline = personTimeline(ws, p.id)
      const facts: Array<[string, string | undefined]> = [
        ['Erfahrung', pr?.experience],
        ['Gebiet', pr?.area],
        ['Hintergrund', pr?.background],
        ['Platz', seatLabel(ws.layout, p.seat)],
      ]
      return `<article class="card" id="p-${esc(p.id)}" data-g="${esc(p.groupId ?? '')}" style="--c:${esc(color(p))}">
  <header><div><h3>${p.introOrder ? `<span class="nr">${p.introOrder}</span>` : ''}${esc(p.name)}</h3><div class="role">${esc(pr?.role)}</div></div>
  <div class="tags">${g ? `<span class="tag">${esc(g.label)}</span>` : ''}${p.nameCheck ? `<span class="tag warn">${esc(p.nameCheck)}</span>` : ''}${p.seatCheck ? `<span class="tag warn">${esc(p.seatCheck)}</span>` : ''}</div></header>
  <dl>${facts.filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
  ${pr?.answer || pr?.board ? `<div class="answer"><div class="lab">${esc(ws.intro.question || 'Antwort auf die Einstiegsfrage')}${pr?.board ? ` · Tafel: ${esc(pr.board)}` : ''}</div><p>${esc(pr?.answer)}</p></div>` : ''}
  ${pr?.tip ? `<div class="tip"><b>Für den Seminartag:</b> ${esc(pr.tip)}</div>` : ''}
  ${p.note ? `<div class="note"><b>Meine Notizen:</b> ${esc(p.note)}</div>` : ''}
  ${timeline.length ? `<div class="tl"><div class="lab">Marker und Notizen</div><ul>${timeline.map(e => `<li><b>${esc(e.label)}</b> <small>${esc(formatDateTime(e.at))}</small>${e.text ? `<br>${esc(e.text)}` : ''}</li>`).join('')}</ul></div>` : ''}
</article>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Teilnehmende ${esc(ws.title)}</title>
<style>
:root{--bg:#F3F5F6;--surface:#fff;--ink:#1E2329;--muted:#5B6B78;--line:#D5DDE2;--accent:#B8871F;--accent-soft:#F6EBD3;--soft:#E3ECF1;
 --body:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;--display:"Avenir Next Condensed","Arial Narrow",Arial,sans-serif}
@media (prefers-color-scheme:dark){:root{--bg:#14191D;--surface:#1D252B;--ink:#E7ECEF;--muted:#9AAAB5;--line:#33414B;--accent:#E0B04C;--accent-soft:#3A3020;--soft:#22333F;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 var(--body);padding:20px max(16px,env(safe-area-inset-left)) 48px}
.wrap{max-width:1180px;margin:0 auto;display:grid;gap:22px}
header.top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:12px;border-bottom:2px solid var(--ink);padding-bottom:10px}
h1{font:700 2rem/1.05 var(--display);margin:0}
.kicker{font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.meta{color:var(--muted);font-size:.92rem;text-align:right}
h2{font:600 1rem/1 var(--display);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 12px}
.box{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:18px}
.legend{display:flex;flex-wrap:wrap;gap:8px}
.chip{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:5px 12px;font:600 .85rem var(--body);cursor:pointer;display:inline-flex;align-items:center;gap:7px}
.chip[aria-pressed=true]{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}
.dot{width:10px;height:10px;border-radius:50%;display:inline-block}
.plan{display:grid;gap:8px}
.edge{grid-column:1/-1;text-align:center;font-size:.8rem;color:var(--muted);border:1px dashed var(--line);border-radius:6px;padding:4px}
.seat{display:block;text-decoration:none;color:var(--ink);border:1px solid var(--line);border-left:5px solid var(--c);background:var(--bg);border-radius:8px;padding:6px 8px;min-height:3.2em;position:relative;min-width:0}
.seat b{display:block;font:600 1rem/1.15 var(--display);overflow-wrap:anywhere}
.seat span{display:block;font-size:.75rem;color:var(--muted)}
.seat i{position:absolute;top:4px;right:6px;font-style:normal;font-size:.72rem;color:var(--muted)}
.seat.empty{border-style:dashed;border-left-width:1px;background:transparent}
.dim{opacity:.3}
.tlabel{font-size:.8rem;color:var(--muted);align-self:center}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:22px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
.card{background:var(--surface);border:1px solid var(--line);border-top:5px solid var(--c);border-radius:10px;padding:16px;display:grid;gap:10px;break-inside:avoid}
.card header{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
.card h3{font:700 1.4rem/1.1 var(--display);margin:0}
.nr{font:600 .9rem var(--body);color:var(--muted);margin-right:8px}
.role{color:var(--muted)}
.tags{display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start}
.tag{font-size:.75rem;font-weight:600;padding:2px 9px;border-radius:999px;background:var(--bg);border:1px solid var(--line)}
.tag.warn{background:var(--accent-soft);border-color:var(--accent)}
dl{display:grid;grid-template-columns:7.5em minmax(0,1fr);gap:4px 12px;margin:0}
dt{font-weight:700;font-size:.82rem;color:var(--muted)}dd{margin:0}
.answer{background:var(--soft);border-radius:8px;padding:10px 12px}.answer p{margin:4px 0 0}
.lab{font-size:.75rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.tip{border-left:3px solid var(--accent);padding-left:10px}
.tl ul{margin:4px 0 0;padding-left:18px}
footer{color:var(--muted);font-size:.85rem}
ul a{color:var(--ink);text-decoration-color:var(--accent);text-underline-offset:3px}
@media print{body{background:#fff;padding:0}.chip{display:none}.card{break-inside:avoid}}
</style>
</head>
<body>
<div class="wrap">
<header class="top"><div><div class="kicker">Teilnehmende und Sitzplan</div><h1>${esc(ws.title)}</h1></div>
<div class="meta">${esc(formatDate(ws.date))} · ${ws.participants.length} Personen${ws.intro.question ? `<br>Einstiegsfrage: ${esc(ws.intro.question)}` : ''}</div></header>
${legend ? `<div class="legend"><button class="chip" data-f="" aria-pressed="true">Alle</button>${legend}</div>` : ''}
<section class="box"><h2>Sitzplan (${ws.layout.kind === 'u' ? 'U-Form' : ws.layout.kind === 'grid' ? 'Reihen' : 'Tischgruppen'})</h2>
<div class="plan" style="grid-template-columns:${gridCols}">${topLabel ? `<div class="edge">${topLabel}</div>` : ''}${cells.join('')}<div class="edge">${bottomLabel}</div></div></section>
${openers || expectations || ws.intro.overview ? `<div class="cols">
${openers ? `<section class="box"><h2>Tafel-Stichworte</h2><ul>${openers}</ul></section>` : ''}
${expectations ? `<section class="box"><h2>Erwartungen und Vorbehalte</h2><ul>${expectations}</ul></section>` : ''}
${ws.intro.overview ? `<section class="box"><h2>Gruppe auf einen Blick</h2><p>${esc(ws.intro.overview)}</p></section>` : ''}
</div>` : ''}
<section><h2>Profile</h2><div class="cards">
${cards}
</div></section>
<footer>Erstellt am ${esc(formatDateTime(now.toISOString()))} mit dem Rhetoriktrainer. Enthält personenbezogene Daten: nur für die Seminarleitung, nach dem Seminar löschen.</footer>
</div>
<script>
document.querySelectorAll('.chip').forEach(function(c){c.addEventListener('click',function(){var f=c.getAttribute('data-f');
document.querySelectorAll('.chip').forEach(function(x){x.setAttribute('aria-pressed',x===c?'true':'false')});
document.querySelectorAll('[data-g]').forEach(function(el){if(el.classList.contains('chip'))return;el.classList.toggle('dim',!!f&&el.getAttribute('data-g')!==f)})})});
</script>
</body>
</html>
`
}
