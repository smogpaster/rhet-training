// Auswertung der Vorstellungsrunde mit Claude (Bring your own key, Aufruf direkt aus der App).
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type { SeatLayout } from '../data/model'
import { IntroResultSchema, type IntroResult } from './introSchema'

export const CLAUDE_MODEL = 'claude-opus-5-5'

export interface IntroInput {
  workshopTitle: string
  question: string
  transcript: string
  /** Sitzplan-Foto als JPEG (base64 ohne Präfix), optional */
  planImageBase64?: string
  /** Stichworte der Trainerin / des Trainers, optional */
  trainerNotes?: string
  /** Bekannte Namen (z. B. aus einer Teilnehmerliste), optional */
  knownNames: string[]
  /** aktuelles Layout als Hinweis */
  layoutHint: SeatLayout['kind']
}

const SYSTEM = `Du wertest für eine Rhetorik-Trainerin bzw. einen Rhetorik-Trainer die Vorstellungsrunde eines Seminars aus.
Eingaben: ein Transkript der Runde (automatisch erstellt, Namen oft falsch geschrieben), meist ein Foto eines handgezeichneten Sitzplans mit Namen und Stichworten, die Einstiegsfrage und ggf. Notizen.

Ziel: je Person ein knappes, verlässliches Profil und ihr Platz im Raum. Die Trainerin liest das später in Sekunden auf einer Datenbrille, während sie vor der Gruppe steht.

Grundsätze:
- Erfinde nichts. Jede Angabe muss im Transkript, auf dem Plan oder in den Notizen stehen. Wurde etwas nicht gesagt, bleibt das Feld leer (""). Schreibe nicht "nicht genannt".
- Entscheide Unsicherheiten nicht still. Weichen Schreibweisen zwischen Transkript und Plan ab oder ist ein Name unleserlich, wähle die plausibelste Schreibweise für "name", beschreibe die Abweichung in "nameCheck" (z. B. Transkript „Uwe“, Plan „Udo“) und liste vollständige Alternativen (Vor- und Nachname) in "nameOptions". Sonst bleiben "nameCheck" leer und "nameOptions" leer.
- Die Vorstellungsrunde läuft meist der Sitzordnung nach. Nutze diese Reihenfolge, um Namen vom Plan den Personen im Transkript zuzuordnen. Ist eine Zuordnung oder ein Platz nur erschlossen, erkläre das kurz in "seatCheck".
- "introOrder" ist die Position der Person in der Runde (1 = zuerst).
- "evidence": zwei bis vier kurze wörtliche Zitate aus dem Transkript, die die Angaben belegen, durch " | " getrennt.
- "answer": die Antwort auf die Einstiegsfrage in zwei bis vier Sätzen, nah am Gesagten.
- "board": das Tafel-Stichwort, wenn es auf dem Plan bzw. in den Notizen steht; sonst ein sehr kurzes Stichwort (höchstens fünf Wörter) aus der eigenen Antwort der Person, wörtlich oder fast wörtlich. Leer, wenn die Person keine Antwort gegeben hat.
- "tip": optional ein Satz, wie die Trainerin das Gesagte am Seminartag aufgreifen kann. Nur ableiten, nichts über die Person behaupten, was nicht gesagt wurde. Leer lassen, wenn sich nichts anbietet.
- "group": eine kurze Personengruppe nach Funktion (z. B. Außendienst, Innendienst, Produktmanagement, Neu im Vertrieb). Verwende für alle Personen dieselben Bezeichnungen und liste sie in "groups".
- Namen, die nur auf dem Plan stehen und keiner Person im Transkript zugeordnet werden können, kommen in "planOnlyNames", nicht in "people".
- "overview": zwei bis drei Sätze zur Gruppe (Erfahrungsspanne, Mischung). "expectations": geäußerte Erwartungen oder Vorbehalte als kurze Punkte, mit Namen in Klammern.

Sitzplätze ("seat"), immer aus Sicht der Trainerin, die an der offenen Seite bzw. vorne steht:
- U-Form ("layoutKind": "u"): area "links" oder "rechts" mit position 1 = am nächsten bei der Trainerin, aufsteigend nach hinten; area "stirnseite" (gegenüber der Trainerin) mit position 1 = ganz links. group ist immer 1.
- Reihen ("grid"): area "reihe", group = Reihe (1 = vorne), position = Platz von links.
- Tischgruppen ("tables"): area "tisch", group = Tischnummer, position = Platz am Tisch.
- Ohne erkennbaren Platz: seat = null und Hinweis in "seatCheck".
"layoutNote": kurz, wie du den Plan gelesen hast (z. B. wo die Trainerin steht).`

export class ClaudeError extends Error {}

/** Ruft Claude auf und liefert das validierte Ergebnis. */
export async function analyzeIntro(apiKey: string, input: IntroInput, onProgress?: (t: string) => void): Promise<IntroResult> {
  const client = new Anthropic({ apiKey: apiKey.trim(), dangerouslyAllowBrowser: true })
  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  if (input.planImageBase64) {
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: input.planImageBase64 } })
  }
  const parts = [
    `Seminar: ${input.workshopTitle}`,
    `Einstiegsfrage: ${input.question || '(nicht angegeben)'}`,
    `Vermutete Sitzform laut App: ${input.layoutHint === 'u' ? 'U-Form' : input.layoutHint === 'grid' ? 'Reihen' : 'Tischgruppen'} (der Plan hat Vorrang)`,
    input.knownNames.length ? `Bereits bekannte Namen: ${input.knownNames.join(', ')}` : '',
    input.trainerNotes?.trim() ? `Notizen der Trainerin:\n${input.trainerNotes.trim()}` : '',
    input.planImageBase64 ? 'Das Bild oben ist der handgezeichnete Sitzplan.' : 'Es gibt kein Foto vom Sitzplan; Plätze bleiben dann leer (seat = null).',
    `Transkript der Vorstellungsrunde:\n<transkript>\n${input.transcript.trim()}\n</transkript>`,
  ].filter(Boolean)
  content.push({ type: 'text', text: parts.join('\n\n') })

  onProgress?.('Claude wertet aus … (dauert meist 30–90 Sekunden)')
  let response
  try {
    // Streaming: lange Transkripte und Denkzeit können die Grenze für einfache Anfragen überschreiten.
    const stream = client.beta.messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'high', format: betaZodOutputFormat(IntroResultSchema) },
      messages: [{ role: 'user', content }],
    })
    response = await stream.finalMessage()
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new ClaudeError('Claude-Schlüssel ungültig. Bitte in den Einstellungen prüfen.')
    if (err instanceof Anthropic.PermissionDeniedError) throw new ClaudeError('Der Claude-Schlüssel hat keine Berechtigung für dieses Modell.')
    if (err instanceof Anthropic.RateLimitError) throw new ClaudeError('Claude: Limit erreicht oder kein Guthaben. Später erneut versuchen.')
    if (err instanceof Anthropic.BadRequestError) throw new ClaudeError(`Claude hat die Anfrage abgelehnt: ${err.message}`)
    if (err instanceof Anthropic.APIConnectionError) throw new ClaudeError('Keine Verbindung zu Claude. Internet und Netzwerk-Freigabe prüfen.')
    if (err instanceof Anthropic.APIError) throw new ClaudeError(`Claude-Fehler ${err.status}: ${err.message}`)
    throw err
  }
  if (response.stop_reason === 'refusal') throw new ClaudeError('Claude hat die Auswertung abgelehnt.')
  if (response.stop_reason === 'max_tokens') throw new ClaudeError('Die Antwort war zu lang. Bitte das Transkript kürzen oder in zwei Teilen auswerten.')
  if (!response.parsed_output) throw new ClaudeError('Die Antwort konnte nicht gelesen werden.')
  return response.parsed_output
}
