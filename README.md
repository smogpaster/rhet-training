# Rhetoriktrainer für Even Realities G2

App für die Even-Hub-Plattform (G2-Brille + R1-Ring), die Rhetoriktrainer in Workshops
unterstützt: Teilnehmende mit Sitzplan und Notizen, Feedback-Marker per Ring während
einer Rede, Rückblick und Export.

Recherche und Architektur: [docs/00-recherche-und-architektur.md](docs/00-recherche-und-architektur.md)

## Entwicklung

```bash
npm install
npm run dev              # Vite-Dev-Server auf http://localhost:5173
npm test                 # Unit-Tests (Vitest)
npm run build            # Typprüfung + Produktions-Build nach dist/
```

Drei Wege zum Ausprobieren:

1. **Desktop-Browser** (ohne Even-App): `http://localhost:5173/?demo` öffnen. Oben erscheint eine
   Brillen-Vorschau mit Knöpfen für Tipp, Doppeltipp, Wischen und Kontextmenü. `?demo` legt einmalig
   Beispieldaten an.
2. **Offizieller Simulator**: `npm run simulate` (bei laufendem Dev-Server). Er zeigt die echte
   Firmware-Darstellung und kann Audio vom Laptop-Mikrofon liefern.
3. **Echte Brille**: `npx evenhub qr --url http://<LAN-IP>:5173`, QR-Code in der Even-App scannen
   (Entwicklermodus durch Login auf hub.evenrealities.com). Details in `docs/`.

## Aufbau

- `src/data/` Datenmodell, Speicher (Even-App-Storage mit Browser-Spiegel), CSV-Import, Sitzplan
- `src/glasses/` Brillen-Schicht: Ereignis-Normalisierung, Seitenbeschreibung, Renderer, Navigation, Bildschirme
- `src/phone/` iPhone-Oberfläche (Preact)
- `src/session/` Aufnahme, Marker und Transkription (ab Meilenstein 3)
