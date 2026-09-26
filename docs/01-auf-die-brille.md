# Anleitung: Die App auf die echte Brille bringen

Es gibt zwei Wege. Weg A ist zum Entwickeln und schnellen Ausprobieren, Weg B installiert
die App dauerhaft in der Even-App, sodass sie auch ohne laufenden Rechner funktioniert.

## Voraussetzungen (einmalig, das musst du selbst tun)

1. **Node.js 20 oder neuer** auf deinem Mac/PC installieren (nodejs.org, LTS-Version).
2. **Repository holen** und Abhängigkeiten installieren:
   ```bash
   git clone https://github.com/smogpaster/rhet-training.git
   cd rhet-training
   npm install
   ```
3. **Brille und Ring koppeln** (Even-App: Devices → Add device), Firmware aktualisieren.
4. **Entwickler-Freischaltung**: Auf https://hub.evenrealities.com/login mit demselben Konto
   anmelden, das du in der Even-App benutzt. Danach die Even-App auf dem iPhone komplett
   beenden (aus der App-Übersicht wischen) und neu öffnen. Im Tab „Even Hub“ erscheint
   jetzt oben rechts ein „Scan QR“-Knopf. Einen separaten Schalter für den Entwicklermodus
   gibt es nicht.

## Weg A: Direkt vom Rechner (QR-Sideload, mit Hot-Reload)

iPhone und Rechner müssen im **selben WLAN** sein.

```bash
npm run dev            # Terminal 1: Dev-Server (läuft weiter)
npx evenhub qr         # Terminal 2: erkennt deine LAN-IP und zeigt einen QR-Code
```

Falls der QR-Code die falsche Adresse enthält: `npx evenhub qr --url http://<deine-LAN-IP>:5173`.

Dann in der Even-App: Tab „Even Hub“ → „Scan QR“ → Code scannen. Die App erscheint auf der
Brille, die iPhone-Oberfläche in der Even-App. Codeänderungen werden live übernommen.

Falls Hot-Reload nicht greift, in `vite.config.ts` unter `server` die Zeile
`hmr: { host: '<deine-LAN-IP>' }` ergänzen.

Einschränkungen laut Even-Doku: Sobald das iPhone gesperrt wird oder die Even-App in den
Hintergrund geht, bricht die Verbindung ab. Manche Berechtigungsabfragen (Mikrofon) werden
im Sideload übersprungen.

## Weg B: Als private Build installieren

```bash
npm run pack           # baut dist/ und erzeugt rhetoriktrainer.ehpk
```

1. Auf https://hub.evenrealities.com einloggen, ein Projekt anlegen (Paketkennung
   `de.smogpaster.rhettraining`, wie in `app.json`), Tab **Private builds**, die `.ehpk` hochladen.
2. Auf dem iPhone in der Even-App: **Me → Apps → Private builds**, den Build auswählen, **Install**.
3. Die App erscheint im Startmenü der Brille wie jede andere App.

Jede Änderung heißt: neu packen, neu hochladen, neu installieren (kein Hot-Reload).

## Was auf der Brille zu testen ist (Checkliste)

Diese Punkte konnten im Simulator nicht geprüft werden und stehen in der Doku nicht eindeutig:

- [ ] Kommt bei einem **Doppeltipp** zuerst ein Einfachtipp an? Die App fängt das ab
      (ein Einfachtipp kürzer als 450 ms vor dem Doppeltipp wird umgewandelt). Falls trotzdem
      doppelte Marker entstehen, den Wert `DOUBLE_GRACE_MS` in `src/glasses/screens/session.ts` erhöhen.
- [ ] **Ring vs. Bügel**: beide lösen dieselben Aktionen aus.
- [ ] **Mikrofon**: Nach einer Session steht auf dem iPhone „Aufnahme gespeichert“. Bei Weg A
      fehlt eventuell die Berechtigungsabfrage, dann Weg B testen.
- [ ] **Teilen-Dialog** beim Markdown-Export (sonst landet der Text in der Zwischenablage).
- [ ] **Hintergrund**: iPhone während einer Session nicht sperren. Prüfen, ob die Session nach
      kurzem Wechsel in eine andere App weiterläuft (die Daten bleiben in jedem Fall erhalten,
      die Startseite bietet „Session fortsetzen“).
- [ ] **Lesbarkeit**: Helligkeitsstufen der Hinweiszeilen (dunkel) und der Redezeit anpassen,
      falls nötig (`textColor` in den Bildschirmen unter `src/glasses/screens/`).

## Bedienung auf der Brille

| Bildschirm | Einfachtipp | Doppeltipp | Wischen | Kontextmenü (Tipp, dann lange drücken) |
|---|---|---|---|---|
| Startseite | Eintrag wählen | – | Liste | App beenden |
| Teilnehmende | Person öffnen | zurück | Liste | Startseite, App beenden |
| Person | Session starten | zurück | vorherige/nächste Person | Startseite, App beenden |
| Session | Marker „stark“ | Marker „besprechen“ | – | Pause/Weiter, Session beenden, App beenden |
| Rückblick | – | Startseite | Seite vor/zurück | Startseite, App beenden |

Vor der ersten Session eines Workshops muss auf dem iPhone unter „Sessions“ bestätigt werden,
dass die Einwilligung der Teilnehmenden vorliegt. Sonst startet die Brille keine Session.
