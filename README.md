# Glasnacht-Stadtgenerator

Sideprojekt zu [Glasnacht](https://github.com/maximiee/glasnacht): erzeugt Stadtpläne per Seed als SVG, im Stil von Watabous City Generator (siehe `docs/Stilvorlage.md`).

## Ziele
- Gleicher Seed, gleiche Stadt.
- Fluss, Küste, Mauer, Viertel mit festen Namen und Orte (POI) aus den Glasnacht-Städtedaten.
- Ausgabe als SVG, im Browser und per Kommandozeile.

## Eingabe: eine JSON pro Stadt
Glasnacht erzeugt pro Stadt eine JSON-Datei, der Generator lädt sie und zeichnet danach (statt Reglern wie bei Watabou). Format siehe `src/stadt.ts`, Beispiel `beispiele/thalassa.json`.

```
npm run svg -- beispiele/thalassa.json out/thalassa.svg
```

Pflicht sind `version` (1) und `name`. Optional: `seed`, `radius`, `wasser` (`fluss`, `kueste`, `keins`), `einwohner` (bestimmt Größe und Maßstab), `mauer`, `lage` (Himmelsrichtung des Meeres bzw. Flussachse), `gelaende` (`gras`, `wueste`, `eis`, `gebirge`), `viertel`, `orte`. Viertel (Grenzen und Namen), Tore und Straßen werden gezeichnet; Häuser, Orte, Plätze, Parks und Gärten, an der Küste Kai, Stege und Schiffe.

## Technik
TypeScript, Vite, Vitest. Eigener Algorithmus, **kein** Code aus TownGeneratorOS (GPLv3) übernommen.

## Befehle
- `npm install`
- `npm run dev` (Vorschau im Browser)
- `npm run check` (Typprüfung und Tests)

## Stand
Umriss (Mauer, Fluss, Küste), Viertel, Tore, Straßen, Brücken, Häuser, Orte, Plätze, Parks (in der Wüste Oasen), Hafen, Felder und Zitadellen sind im Stil der Vorlage umgesetzt. Größe und Maßstab folgen der Einwohnerzahl. Offen: Feinschliff der Beschriftung (Namen teils über Parks oder Mauern), kurze Kais an breiten Küsten.

## Gebäudepläne
Grundrisse für einzelne Gebäude: JSON mit `name`, `etagen` (oder `raeume` für ein Stockwerk), je Raum `name`, `art`, `flaeche`, `kurz`. Der Generator teilt die Grundfläche, setzt Türen (alle Räume erreichbar), Fenster, Treppenhaus und Möbel; Beispiele in `beispiele/`. `gebaeudeDateiAlsKarte(json)` liefert SVG und die nummerierten Räume. `npm run svg -- beispiele/gasthaus.json out.svg` erkennt Gebäude an `raeume`/`etagen`.

## Höhlenpläne
Höhlen als Kammern mit Gängen: JSON mit `name`, `kammern` (je `name`, `art`, `durchmesser`, `kurz`) und optional `verbindungen` als Namenspaare. Der Generator legt die Kammern um die erste herum, verbindet alle über schlängelnde Gänge (plus ein paar Schleifen), führt einen Zugang nach außen und zeichnet Fels, Tropfsteine, Seen, Schächte usw. Höchstens 16 Kammern. `hoehleDateiAlsKarte(json)` liefert SVG und nummerierte Kammern; `npm run svg -- beispiele/hoehle.json out.svg` erkennt Höhlen an `kammern`. Anbindung an die App: `docs/Anbindung_Hoehle.md`.

## Reiserouten
Ausschnitt der Weltkarte mit Route: JSON mit `name` und `stationen` (je `name` und entweder `ort` aus der Ortsliste oder `x`/`y` in Kartenpixeln, optional `weg` = strasse, pfad, schiff, pass, `punkt: true` für unbeschriftete Zwischenpunkte, `kurz`). Der Generator glättet den Verlauf, schneidet die Weltkarte passend aus, zeichnet Strecke mit Richtungspfeilen, nummerierte Stationen, Kilometer-Maßstab und Streckenlänge (1 px ≈ 2 km). Die Route folgt Luftlinie zwischen den Stationen; Straßen und Küsten folgt sie nur über Zwischenpunkte. `routeDateiAlsKarte(json, orte, bild)`: `orte` = Name → {x, y}, `bild` = `{href, breite, hoehe}` der Weltkarte (URL oder data:-URI). CLI: `npm run svg -- beispiele/route.json out.svg --karte <Grundkarte.jpg> --orte <06_orte.json>`. Anbindung: `docs/Anbindung_Route.md`.
