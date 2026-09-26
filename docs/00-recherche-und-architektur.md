# Schritt 0: Recherche und Architekturvorschlag

Stand: 26.09.2026. Quellen: offizielle Doku unter hub.evenrealities.com/docs, die
Typdefinitionen des npm-Pakets `@evenrealities/even_hub_sdk` **0.0.16** (aktuell),
die offiziellen Templates (`even-realities/evenhub-templates`), das Skill-Paket
`even-realities/everything-evenhub` und die Community-Notizen `nickustinov/even-g2-notes`.

Aktuelle Versionen: SDK 0.0.16, CLI 0.1.14, Simulator 0.9.5, Even App ≥ 2.2.10.

---

## 1. Ring-Eingaben (Even R1)

Der R1-Ring liefert **exakt dieselben Gesten wie die Bügel-Touchpads** der Brille.
Über `sysEvent.eventSource` lässt sich unterscheiden, woher eine Geste kommt
(`TOUCH_EVENT_FROM_RING = 2`, rechter Bügel = 1, linker Bügel = 3).

| Geste | SDK-Event | Wert | Kommt an als |
|---|---|---|---|
| Einfachtipp | `CLICK_EVENT` | 0 | `sysEvent` (bei Textcontainer) bzw. `listEvent` (bei Listencontainer, mit Index des gewählten Eintrags) |
| Doppeltipp | `DOUBLE_CLICK_EVENT` | 3 | `sysEvent` |
| Wischen hoch | `SCROLL_TOP_EVENT` | 1 | `textEvent` (bei Listen scrollt die Firmware selbst, kein Event) |
| Wischen runter | `SCROLL_BOTTOM_EVENT` | 2 | `textEvent` |
| Langes Drücken (Start) | `LONG_PRESS_EVENT` | 9 | `sysEvent` (SDK ≥ 0.0.14) |
| Langes Drücken (Loslassen) | `LONG_PRESS_RELEASE_EVENT` | 10 | `sysEvent` |
| Tipp, dann lange drücken | öffnet das **Kontextmenü** des Betriebssystems | | `menuItemClickEvent` mit `itemID` |

Wichtige Details:

- **Einfachtipp kommt ohne `eventType`-Feld an** (Protobuf lässt Null-Werte weg).
  Das offizielle Template zeigt das korrekte Muster; ich übernehme es.
- Das Kontextmenü (max. 10 Einträge, Beschriftung max. 32 Bytes) definieren wir
  selbst pro Seite. Es ist der saubere Weg für „Session beenden“, „Pause“, „App beenden“.
- Ob bei einem Doppeltipp zusätzlich vorher ein Einfachtipp gemeldet wird, steht
  nicht in der Doku. Das muss auf dem Gerät getestet werden; falls ja, brauchen wir
  eine kurze Verzögerung (ca. 300 ms) bevor ein Einfachtipp als Marker gilt.
- Die Doku empfiehlt Doppeltipp als Standardgeste zum Beenden einer App. Wir
  belegen Doppeltipp mit einem Marker und bieten „Beenden“ über das Kontextmenü an.
  Das ist laut Doku zulässig (Pflicht ist nur, dass es einen Ausstieg per Brille gibt
  und der Systemdialog `shutDownPageContainer(1)` benutzt wird).

## 2. Mikrofon, Spracherkennung, Rohaudio

**Mikrofonzugriff: ja, beides.**
`bridge.audioControl(true, AudioInputSource.Glasses)` (4-Mikrofon-Array der Brille)
oder `AudioInputSource.Phone` (iPhone-Mikrofon). Audio kommt als Rohdaten über
`event.audioEvent.audioPcm`: **PCM, 16 kHz, 16 Bit signed little-endian, mono**.
Im Simulator ca. alle 100 ms ein Paket mit 3200 Bytes. Zusätzlich liefert das SDK pro
Paket `direction` (Richtung, kann `null` sein) und `speakerRole` (Self/Other/Unknown,
eine Heuristik der App, keine Garantie). Berechtigungen in `app.json`:
`g2-microphone` bzw. `phone-microphone`.

**Rohaudio aufzeichnen: ja.** Wir bekommen die PCM-Pakete und können sie selbst
puffern. Rechnung: 32 KB pro Sekunde, also ca. 1,9 MB pro Minute, ca. 19 MB für
eine 10-Minuten-Rede. Das passt problemlos in den Arbeitsspeicher der WebView.

**Eingebaute Spracherkennung: nein.** Das SDK enthält keine ASR. Das offizielle
„ASR-Template“ ist nur ein Gerüst mit einem leeren Anschluss (`stt.ts`), in den man
einen eigenen Dienst einhängt (Zitat: „STT provider is a blank stub“). Die
Web-Speech-API (`SpeechRecognition`) steht in der iOS-WKWebView nicht zur
Verfügung. **Deutsch hängt also allein vom gewählten Dienst ab** (siehe Abschnitt 5).

## 3. Speicher und Display

**Speicher (alles lokal auf dem iPhone, kein Server nötig):**

| Möglichkeit | Bewertung laut Doku |
|---|---|
| `bridge.setLocalStorage(key, string)` / `getLocalStorage(key)` | Offizieller Weg. Überlebt Hintergrund, App-Kill und Updates; wird beim Deinstallieren gelöscht. Nur Strings, große Inhalte in Blöcke aufteilen. |
| Browser-`localStorage` | FAQ sagt „ja, überlebt alles“, das Skill-Paket von Even sagt „nicht zuverlässig“. **Widerspruch in der Doku**, daher nur als Spiegel, nicht als Hauptspeicher. |
| IndexedDB / OPFS | „Ja, aber Quotas nicht dokumentiert, best-effort.“ Geeignet für große Audiodaten, die sowieso gelöscht werden dürfen. |
| Eigener Server | Möglich per `fetch`/WebSocket, Domain muss in `app.json` stehen und CORS liefern. Für DSGVO-Standard nicht nötig. |

**Display (576 × 288 px pro Auge, 16 Grünstufen, kein Hintergrund, alles Textcontainer):**

- Max. 12 Container pro Seite (8 Text/Liste + 4 Bild), genau einer fängt Eingaben.
- Ein Font, nicht monospaced, keine Schriftgröße, kein Fett, kein Zentrieren.
  Zeilenhöhe 27 px, also **max. ca. 10 Zeilen**, ca. 400–500 Zeichen Vollbild.
- Textcontainer: 1000 Zeichen beim Aufbau, 2000 bei Update (`textContainerUpgrade`, flackerfrei).
  Helligkeit `textColor` 0–4 (0 dunkelste Stufe) für „dezente“ Anzeigen.
- Listencontainer: max. 20 Einträge à 64 Zeichen, Scrollen macht die Firmware.
  Änderung nur per kompletter Seiten-Neuaufbau (`rebuildPageContainer`, kurzes Flackern).
- **Umlaute und ß sind vorhanden** (Latin-1 komplett). **Das Häkchen „✓“ (U+2713) fehlt**
  im Font und würde unsichtbar bleiben. Ersatz: `●`, `■`, `★` oder `»`.
- Bluetooth ist langsam: Textupdates ca. 1× pro Sekunde sind in Ordnung, alle
  Bridge-Aufrufe nacheinander (`await`), nie parallel.

**Hintergrund/Sperre (wichtig für Aufnahmen):** Auf iOS läuft die WebView im
Hintergrund weiter, aber beim Sideload per QR „killt das Sperren des Telefons die
Verbindung“, und private Builds bestehen den 5-Minuten-Sperrtest laut Doku noch nicht.
Die im Skill-Paket beschriebenen Funktionen `setBackgroundState`/`onBackgroundRestore`
**existieren im SDK 0.0.16 nicht** (im Export nicht enthalten). Konsequenz für den
Workshop: **iPhone während einer Session entsperrt lassen und die Even-App im
Vordergrund.** Wir sichern den Session-Zustand trotzdem laufend, damit nichts verloren geht.

## 4. Werkzeuge und Ablauf

- Entwicklung: Vite + TypeScript, `npm run dev`, Simulator `npx evenhub-simulator http://localhost:5173`.
  Der Simulator kann Tipp, Doppeltipp, Wischen, langes Drücken, Kontextmenü und Audio vom
  Laptop-Mikrofon. Er ist nicht pixelgenau.
- Auf die echte Brille: `npx evenhub qr --url http://<LAN-IP>:5173`, QR-Code mit der
  Even-App scannen (Entwicklermodus wird durch Login auf hub.evenrealities.com aktiviert,
  danach App beenden und neu öffnen). Für einen installierbaren Stand: `evenhub pack`
  → `.ehpk` → im Portal als „Private build“ hochladen → in der App unter
  Me → Apps → Private builds installieren.

## 5. Transkription: Optionen, Kosten, Datenschutz

Da du auf der Brille **kein Live-Transkript** willst, reicht eine
**Transkription nach Session-Ende** (Batch). Das ist billiger, robuster und leichter
austauschbar als Streaming. Marker-Zeitstempel sind relativ zum Aufnahmestart, die
Wort-Zeitstempel des Dienstes ebenso, die Zuordnung ist damit trivial.

| Option | Deutsch | Kosten (Stand 2026, ca.) | Datenschutz | Aufwand |
|---|---|---|---|---|
| **OpenAI** `whisper-1` / `gpt-4o-transcribe` (Batch, Wort-Zeitstempel bei whisper-1) | sehr gut | 0,006 $/min ≈ 0,36 $/Std. | US-Anbieter, AV-Vertrag (DPA) verfügbar, API-Daten werden nicht zum Training genutzt, 30 Tage Missbrauchs-Log. Datei max. 25 MB → wir schneiden in 10-Minuten-Stücke. | gering |
| **Deepgram Nova-3** (Batch oder Streaming) | gut | Batch 0,0043 $/min, Streaming 0,0077 $/min | US-Anbieter, DPA verfügbar; EU-Verarbeitung nur in Enterprise-Verträgen | gering |
| **Speechmatics** (Batch oder Streaming) | sehr gut | Batch ca. 0,13 $/Std., Streaming auf Anfrage | Britischer Anbieter, EU-Rechenzentren wählbar, GDPR-fokussiert | gering |
| **Selbst gehostet** (faster-whisper auf eigenem Mac/VPS) | sehr gut (large-v3) | 0 €/min, aber du betreibst einen HTTPS-Server mit CORS | Daten verlassen deine Infrastruktur nicht | mittel |
| **Whisper im Browser** (WebAssembly in der WebView) | mäßig (nur kleine Modelle) | 0 € | ideal | hoch, Geschwindigkeit auf dem iPhone unklar |

**Empfehlung:** Transkription hinter einer kleinen Schnittstelle (`TranscriptionProvider`)
bauen, sodass der Dienst austauschbar bleibt. Für den Start **OpenAI whisper-1 (Batch)**
oder, wenn EU-Verarbeitung wichtiger ist als Einfachheit, **Speechmatics**.
Ich baue keinen kostenpflichtigen Dienst ein, bevor du entschieden hast.

## 6. Architekturvorschlag

**Stack:** Vite + TypeScript, SDK 0.0.16, Preact für die iPhone-Oberfläche
(3 KB, React-ähnlich, gut dokumentiert), die Brillen-Anzeige als eigenes Modul ohne Framework.
Kein Backend, keine Accounts, alles lokal.

```
rhet-training/
├── app.json                 Manifest (Berechtigungen: g2-microphone, später network für den STT-Dienst)
├── index.html
├── src/
│   ├── main.ts              Start: Bridge verbinden, Daten laden, Phone-UI + Glasses-UI starten
│   ├── data/
│   │   ├── model.ts         Typen: Workshop, Teilnehmer, Sitzplatz, Session, Marker, Transkript
│   │   ├── store.ts         Zustand + Persistenz (bridge.setLocalStorage in Blöcken, Browser-localStorage als Spiegel)
│   │   └── csv.ts           CSV-Import Teilnehmende
│   ├── glasses/
│   │   ├── input.ts         Event-Normalisierung (Tipp/Doppeltipp/Wischen/lang, Ring vs. Bügel)
│   │   ├── render.ts        Serialisierte Bridge-Aufrufe mit Timeout, Textupdates entprellt
│   │   └── screens/         home, participants, participantDetail, session, review
│   ├── session/
│   │   ├── recorder.ts      PCM puffern, Session-Uhr, Marker setzen
│   │   └── transcription/   provider.ts (Schnittstelle), openai.ts / speechmatics.ts (später), align.ts (Ausschnitt −10 s/+5 s)
│   ├── phone/               Preact-Oberfläche: Workshops, Teilnehmende + Sitzplan, Sessions, Export, Einstellungen/Datenschutz
│   └── export/markdown.ts
└── docs/
```

**Brillen-Bildschirme und Ring-Belegung:**

| Bildschirm | Einfachtipp | Doppeltipp | Wischen | Kontextmenü (Tipp + lange drücken) |
|---|---|---|---|---|
| Start (Liste) | Eintrag wählen | – | Liste scrollen (Firmware) | App beenden |
| Teilnehmende (Liste, max. 20 pro Seite) | Person öffnen | zurück | scrollen | Nächste Seite, App beenden |
| Person (Text: Name, Platz, Notiz, bisherige Marker) | Session starten | zurück | vorherige/nächste Person | – |
| **Session** (Text, dezent: Redezeit + letzte Bestätigung) | Marker **„stark“** | Marker **„besprechen“** | ignoriert (oder später dritte Kategorie) | Pause, Session beenden |
| Rückblick (Text, blätterbar) | – | zurück | Marker vor/zurück | – |

Session-Anzeige, Beispiel (dunkel, `textColor` 1–2):

```
02:14

● stark  02:14
```

Die Bestätigungszeile bleibt ca. 3 Sekunden, die Uhr wird einmal pro Sekunde aktualisiert.

**Datenmodell (vereinfacht):**

- Workshop: id, Titel, Datum, Sitzplan-Layout (Raster oder U-Form), Einwilligung bestätigt (ja/nein), Teilnehmende[]
- Teilnehmer: id, Name, Sitzplatz (Reihe/Spalte bzw. Position), Notiz
- Session: id, Teilnehmer-id, Start, Dauer, Marker[], Transkript (Wörter mit Zeitstempeln, optional), Audio gelöscht (ja/nein)
- Marker: Zeit in Sekunden, Kategorie („stark“, „besprechen“), Ausschnitt −10 s / +5 s (nach Transkription)

**Datenschutz-Bausteine:** Einwilligungs-Hinweis vor der ersten Aufnahme je Workshop
(muss bestätigt werden), Schalter „Audio nach Transkription automatisch löschen“ (Standard: an),
„Workshop komplett löschen“ mit Rückfrage, Audio nur im Arbeitsspeicher bzw. IndexedDB, nie in
den Export. Der STT-Schlüssel wird lokal in den Einstellungen gespeichert, nicht im Code.

**Export:** Markdown pro Session (Name, Datum, Dauer, Markerliste mit Zeit, Kategorie, Ausschnitt).
Auf dem iPhone per Teilen-Dialog (`navigator.share` mit Datei, falls die WebView das erlaubt,
sonst Kopieren in die Zwischenablage). Ob `navigator.share` in der Even-WebView funktioniert,
steht nicht in der Doku und wird am Gerät getestet.

## 7. Meilensteine

1. Projektgerüst + Datenmodell + Speicher, Start-Bildschirm auf der Brille im Simulator.
2. **Funktion 2 minimal:** Teilnehmende auf dem iPhone anlegen/bearbeiten, CSV-Import,
   einfacher Sitzplan; auf der Brille durch Teilnehmende blättern.
3. **Funktion 1a:** Session starten, Redezeit, Marker per Ring mit Zeitstempel,
   Rückblick auf Brille und iPhone, Markdown-Export ohne Transkript.
4. **Funktion 1b:** Audioaufnahme + Transkription über den von dir gewählten Dienst,
   Ausschnitte an Markern, Auto-Löschen des Audios.
5. Anleitung: QR-Sideload auf deine Brille, dann `.ehpk` als private Build.

## 8. Offene Entscheidungen für dich

1. **Transkriptionsdienst:** OpenAI (einfach, günstig), Speechmatics (EU), selbst gehostet, oder erst mal ohne?
   Ich baue Meilenstein 1–3 ohne jeden Dienst; die Entscheidung wird erst für Meilenstein 4 gebraucht.
2. **Ring-Belegung** wie in der Tabelle oben in Ordnung? (Einfachtipp = stark, Doppeltipp = besprechen,
   Beenden/Pause über das Kontextmenü.)
3. **Paketkennung** für `app.json`, z. B. `de.deinname.rhettraining` (nur Kleinbuchstaben und Punkte).
4. Preact für die iPhone-Oberfläche in Ordnung, oder lieber komplett ohne Framework?
