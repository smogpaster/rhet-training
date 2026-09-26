import type { Marker, TranscriptWord } from '../../data/model'

export const EXCERPT_BEFORE_SEC = 10
export const EXCERPT_AFTER_SEC = 5

/** Wörter im Fenster [t − before, t + after] als Text. */
export function excerptAt(words: TranscriptWord[], t: number, before = EXCERPT_BEFORE_SEC, after = EXCERPT_AFTER_SEC): string {
  const from = t - before
  const to = t + after
  return words
    .filter(w => w.e >= from && w.s <= to)
    .map(w => w.w)
    .join(' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim()
}

/** Füllt die Transkript-Ausschnitte aller Marker. */
export function fillExcerpts(markers: Marker[], words: TranscriptWord[]): Marker[] {
  return markers.map(m => ({ ...m, excerpt: excerptAt(words, m.t) || undefined }))
}
