# Anbindung der Gebäudepläne an die Glasnacht-App

Stand: 23.10.2026 (Generator fertig, App-Anbindung offen, soll im Glasnacht-Repo geschehen).

## Schnittstelle des Pakets
- `gebaeudeDateiAlsKarte(json)` → `{ svg, breite: 1400, hoehe: 1280, marken: [{ nr, name, art: 'raum', x, y, kurz }] }`
- `liesGebaeude(json)` prüft die Eingabe und wirft deutsche Fehlermeldungen, die die KI zum Korrigieren nutzen kann.
- `istGebaeude(json)`: Gebäude (`raeume` oder `etagen`) oder Stadt?
- `RAUM_ARTEN`, `GEBAEUDE_MAX_ETAGEN` (5), `GEBAEUDE_MAX_RAEUME` (14 je Etage).

## Eingabe (Gebäude-JSON, Version 1)
```json
{
  "version": 1,
  "name": "Gasthaus Zur Furt",
  "typ": "Gasthaus",
  "seed": "furt",
  "gelaende": "gras",
  "etagen": [
    { "name": "Erdgeschoss", "raeume": [
      { "name": "Schankstube", "art": "schankraum", "flaeche": 44, "kurz": "Der große Gastraum." }
    ] }
  ]
}
```
- Ein Stockwerk: `raeume` statt `etagen`. Ohne `seed` gilt der Name; die App sollte den Seed festlegen (z. B. `<Spielstand-Id>#<Name>`), damit der Plan gleich bleibt.
- `art`: wohnraum, schlafraum, kueche, vorrat, werkstatt, schankraum, laden, lager, flur, halle, altar, kammer, stall, bad, keller, saal, wachraum, zelle, raum. Ohne `art`: `raum`.
- `flaeche` in Quadratmetern (3 bis 400), sonst nach Art. Die Etagen teilen sich eine Grundfläche; mehrere Etagen bekommen ein Treppenhaus an der Westwand.

## Vorschlag für die App (wie `siedlung_erschaffen`)
- KI-Werkzeug `gebaeude_erschaffen` mit zod-Schema nach der Eingabe oben, Fehler aus `liesGebaeude` als `RegelFehler` zurück an die KI.
- Spielstand: `welt.gebaeude: Record<string, unknown>[]` (geprüftes JSON mit festem Seed), Name einmalig je Spielstand.
- Anzeige `{ art: 'gebaeude', nr, name }`, Ereignis `{ typ: 'gebaeude', nr, name }`.
- Routen: `GET /api/spielstaende/:id/gebaeude/:nr/bild` (SVG), `GET /api/spielstaende/:id/gebaeude/:nr` (Marken für die Raumliste), `POST /api/gebaeudeplan` (JSON → SVG).
- Client: Bild im Verlauf, darunter die nummerierte Raumliste (Nummer, Name, Kurztext), Marken wie bei Stadtplänen klickbar.
- Prompt (`08_KI_Spielleiter.md`): Wann die KI ein Gebäude zeichnen lässt (Figur betritt ein Haus, das für die Szene wichtig ist), und dass sie nur Räume und Größen liefert.
- Später: Orte der Stadtpläne (Gasthaus, Tempel ...) mit vorgezeichneten Gebäudeplänen verknüpfen, Ablage wie `Karten/Stadtkarten/plaene/`.
