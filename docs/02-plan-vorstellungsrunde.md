# Plan: Teilnehmenden-Übersicht aus der Vorstellungsrunde

Stand 29.10.2026. Grundlage: bestehende App (Meilenstein 1–3), Even Hub SDK 0.0.16,
Claude-API-Doku.

## Was die bestehende App schon mitbringt

| Baustein | Vorhanden | Fehlt für die neue Funktion |
|---|---|---|
| Workshop, Teilnehmende, Sitzplan | Name, Notiz, Platz; Layout Raster oder U-Form | Profilfelder, Tischgruppen, Namensvarianten |
| CSV-Import | ja | Import von Transkript (.txt) und Foto |
| Brille: Teilnehmerliste, Detail | Liste + Detail per Ring | schematischer Sitzplan, Navigation über Plätze |
| Feedback-Marker | nur in einer Rede-Session | Marker/Notiz direkt an eine Person, ohne Session |
| Aufnahme | PCM der Brille, lokal in IndexedDB | Spracherkennung (Dienst noch nicht gewählt) |
| Export | Markdown je Session | Gesamtübersicht aller Profile (HTML/PDF) |
| Löschen | Workshop inkl. Aufnahmen | zusätzlich Fotos, Transkripte, Profile |

## Was das SDK hergibt und was nicht

- **Kein Zeichnen.** Die Brille kennt nur Text-, Listen- und Bildcontainer, max. 8 Text/Liste
  pro Seite. Ein Sitzplan wird deshalb aus mehreren **Textcontainern** gebaut, die räumlich
  angeordnet sind: bei U-Form ein Container für die linke Seite, einer für die Stirnseite,
  einer für die rechte Seite, dazu eine Infozeile. Bei Reihen ein Container pro Reihe
  (max. 6 Reihen), bei Tischgruppen einer pro Tisch (max. 6 Tische). Die gewählte Person
  wird mit `▶` und voller Helligkeit markiert, alle anderen gedimmt. Textupdates sind
  flackerfrei und schnell genug für Ring-Navigation.
- **Bildcontainer sind zu langsam** für Navigation (0,5–2 s pro Bild, max. 288×144 px).
  Ein gezeichneter Plan als Bild käme nur als statische Ansicht in Frage. Ich empfehle die
  Textvariante.
- **Platz für Namen**: Die Schrift ist nicht monospaced, 576 px Breite. Auf dem Plan stehen
  deshalb **Vornamen bzw. Kurznamen** (bei Doppelungen mit Initiale, „Uwe M.“).
- **Ring**: Wischen wandert im Uhrzeigersinn durch die Plätze, Tipp öffnet das Kurzprofil,
  Doppeltipp zurück. Für den Schnellzugriff „Wer sitzt wo?“ bietet sich **langes Drücken**
  an (bisher unbelegt). Ob langes Drücken auf dem Gerät sauber vom Kontextmenü
  (Tipp + lang) getrennt ankommt, muss ein Gerätetest zeigen. Fallback: Eintrag oben auf der
  Startseite und im Kontextmenü jeder Seite.
- **Kurzprofil**: Name, Funktion, eine Zeile Türöffner. Das passt in 3–4 Zeilen und ist in
  Sekunden lesbar. Weitere Felder auf Wischen, nicht auf dem ersten Blick.
- **Foto auswählen**: Das SDK hat `pickImageFromAlbum()` und `captureImageFromCamera()`
  (Berechtigungen `album`, `camera`). Fallback ist ein normales Datei-Feld.
- **Netzwerk**: Aufrufe der Claude-API brauchen `https://api.anthropic.com` in der
  Netzwerk-Freigabe von `app.json`. Die API erlaubt Aufrufe direkt aus dem Browser
  (das offizielle TypeScript-SDK hat dafür eine eigene Option). Ein eigener Server ist
  nicht nötig.

## Auswertung per LLM

Ein Aufruf an Claude mit Foto + Transkript + Einstiegsfrage. Claude liefert strukturiertes
JSON (über „structured outputs“, also garantiert gültig):

- `seats`: erkannte Plätze mit Position im Layout und gelesenem Namen,
  `confidence` und ggf. `alternatives` (unleserlich, „Uwe/Udo“).
- `people`: je Person aus dem Transkript Name, Reihenfolge in der Runde, Funktion,
  Erfahrung, Gebiet, Hintergrund, Antwort auf die Einstiegsfrage, Tafel-Stichworte,
  optionaler Hinweis für den Seminartag. **Jedes Feld mit Belegzitat** aus dem Transkript,
  leere Felder bleiben leer statt erfunden.
- `matches`: Zuordnung Platz ↔ Person mit Begründung (Schreibweise, Reihenfolge) und
  Status `sicher` / `prüfen`.

Die App übernimmt nichts still: Alles mit Status „prüfen“ erscheint in der Korrekturansicht
gelb markiert, mit beiden Schreibweisen zur Auswahl. Die Belegzitate sind dort aufklappbar,
damit du schnell siehst, woher eine Angabe stammt.

Modell: Claude Opus 5 (gute Handschrift-Erkennung, lange Transkripte). Kosten je Seminar
grob im Cent-Bereich.

## Korrektur in der Begleit-App

Neue Ansicht „Vorstellungsrunde“ pro Workshop:

1. Einstiegsfrage eingeben, Transkript (.txt) und Foto wählen, „Auswerten“.
2. Ergebnis: Sitzplan oben (Plätze antippen, Person zuweisen, verschieben), darunter
   Profilkarten mit allen Feldern direkt editierbar, „prüfen“-Punkte zuerst.
3. „Übernehmen“ schreibt in die bestehende Teilnehmerliste (bestehende Personen werden
   ergänzt, nicht dupliziert).

## Notizen während des Seminars

- Von Plan oder Profil aus per Ring: **Tipp = „stark“, Doppeltipp = „besprechen“** wie
  bisher, aber direkt an der Person, ohne Rede-Session. Technisch werden Session-Marker und
  diese Personen-Marker in einer gemeinsamen Zeitleiste pro Person zusammengeführt, das
  Profil zeigt beides.
- **Sprachnotiz**: im Kontextmenü „Sprachnotiz“, Aufnahme über das Brillenmikrofon bis
  zum nächsten Tipp. Siehe offene Frage 2.

## Export

Eine in sich geschlossene **HTML-Seite** (Sitzplan + alle Profile + Marker/Notizen), teilbar
über den Teilen-Dialog. Aus Safari lässt sie sich als PDF drucken. Direkte PDF-Erzeugung in
der App ist mit einer Bibliothek möglich, kann aber nachgezogen werden. Aufbau orientiert an
deiner Seminar-Übersicht, sobald sie vorliegt.

## Datenschutz

- Alles bleibt lokal in der Even-App. Ausnahme: Für die Auswertung gehen Transkript und
  Foto einmalig an die Claude-API (Anthropic, USA, AV-Vertrag verfügbar, API-Daten werden
  nicht zum Training genutzt). Vor dem ersten Aufruf je Workshop erscheint ein Hinweis.
- Foto und Transkript werden nach dem Übernehmen standardmäßig gelöscht (Schalter).
- „Workshop löschen“ entfernt zusätzlich Fotos, Transkripte, Profile und Sprachnotizen.
- Der API-Schlüssel liegt nur lokal in den Einstellungen.

## Schritte

1. Datenmodell erweitern (Profil, Namensvarianten, Tischgruppen, Personen-Marker), Migration
   bestehender Daten. Korrekturansicht mit manueller Eingabe, ohne LLM.
2. Brille: schematischer Sitzplan, Navigation, Kurzprofil, Schnellzugriff, Marker an Person.
   Test im Simulator.
3. Import + Claude-Auswertung mit strukturiertem Ergebnis, Prüfmarkierungen. Test mit einem
   Beispieltranskript und einem gezeichneten Plan.
4. HTML-Export der Gesamtübersicht, Löschfunktionen erweitern.
5. Sprachnotizen (abhängig von Frage 2).

Jeder Schritt einzeln committet und testbar.

## Abgleich mit deiner Seminar-Übersicht („Hart aber fair“)

Die Referenz-Seite deckt sich mit dem Plan. Daraus übernehme ich zusätzlich:

- **Personengruppe** je Person (z. B. Außendienst, Innendienst, Produkt/Business Development,
  Neu im Vertrieb) mit Farbe und Filter. Die Gruppen sind pro Workshop frei benennbar, das LLM
  schlägt sie vor. Auf der Brille: Filter im Kontextmenü, z. B. nur Außendienst hell, der
  Rest gedimmt. Hilfreich beim Einteilen der Rollenspielgruppen.
- **Platzcodes nach Seiten** (links, Stirnseite, rechts, jeweils durchnummeriert) und die
  **Nummer in der Vorstellungsrunde** am Platz. Die Runde läuft in der Referenz einmal um das
  U herum. Genau diese Reihenfolge nimmt die Ring-Navigation auf der Brille.
- **Profilfelder** wie in der Referenz: Funktion, Erfahrung, Gebiet, Hintergrund, bester
  Türöffner (ausführlich), Tafel-Stichwort (kurz), „Für heute“-Hinweis, Hinweis zur
  Schreibweise, eigene Notizen.
- **Gruppenebene**: „Türöffner der Gruppe“ (aus den Tafel-Stichworten), „Erwartungen und
  Vorbehalte“, „Gruppe auf einen Blick“ (kurze Einschätzung plus Anzahl je Personengruppe).
  Das LLM schlägt diese Texte vor, du korrigierst sie wie die Profile.

Auswirkungen auf die Brille:

- Das **Kurzprofil** zeigt Name, Funktion und das **Tafel-Stichwort** als die eine Zeile
  (z. B. „an Probleme anknüpfen“). Die ausführlichen Türöffner-Texte sind mit 200–300
  Zeichen zu lang für einen Blick vor der Gruppe. Gibt es kein Stichwort, steht dort der
  gekürzte erste Satz. Wischen zeigt die zweite Seite mit Erfahrung, Gebiet und „Für heute“.
- **Kurznamen**: Zwei gleiche Vornamen werden automatisch mit Initiale unterschieden
  („Matthias B.“, „Matthias G.“). Kurznamen sind in der Korrekturansicht änderbar.
- Ein U mit 4 + 4 + 3 Plätzen passt gut in drei Textcontainer.

Für den **Export** übernehme ich den Aufbau der Referenz: Sitzplan in U-Form mit farbigen
Plätzen und Rundennummer, Gruppenfilter, Profilkarten, Gruppenübersicht, dazu die Marker und
Notizen aus dem Seminar. Die Exportseite lädt keine externen Schriften, damit sie offline
funktioniert und nichts nach außen meldet.
