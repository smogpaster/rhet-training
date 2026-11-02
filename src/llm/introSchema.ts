import { z } from 'zod'

/**
 * Antwortformat der Auswertung. Claude liefert über Structured Outputs garantiert
 * JSON in dieser Form. Leere Zeichenkette = nicht gesagt / nicht erkennbar.
 */
export const SeatRefSchema = z.object({
  /** links/rechts/stirnseite bei U-Form, reihe bei Reihen, tisch bei Tischgruppen */
  area: z.enum(['links', 'stirnseite', 'rechts', 'reihe', 'tisch']),
  /** Reihen- bzw. Tischnummer; bei U-Form immer 1 */
  group: z.number().int(),
  /** Position im Bereich, Zählweise siehe Prompt */
  position: z.number().int(),
})

export const IntroPersonSchema = z.object({
  name: z.string(),
  nameTranscript: z.string(),
  namePlan: z.string(),
  nameCheck: z.string(),
  nameOptions: z.array(z.string()),
  introOrder: z.number().int(),
  seat: SeatRefSchema.nullable(),
  seatCheck: z.string(),
  group: z.string(),
  role: z.string(),
  experience: z.string(),
  area: z.string(),
  background: z.string(),
  answer: z.string(),
  board: z.string(),
  tip: z.string(),
  evidence: z.string(),
})

export const IntroResultSchema = z.object({
  layoutKind: z.enum(['u', 'grid', 'tables']),
  layoutNote: z.string(),
  groups: z.array(z.string()),
  people: z.array(IntroPersonSchema),
  planOnlyNames: z.array(z.string()),
  overview: z.string(),
  expectations: z.array(z.string()),
})

export type IntroResult = z.infer<typeof IntroResultSchema>
export type IntroPerson = z.infer<typeof IntroPersonSchema>
export type SeatRef = z.infer<typeof SeatRefSchema>
