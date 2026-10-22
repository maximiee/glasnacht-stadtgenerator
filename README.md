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

Pflicht sind `version` (1) und `name`. Optional: `seed`, `radius`, `wasser` (`fluss`, `kueste`, `keins`), `einwohner` (bestimmt Größe und Maßstab), `mauer`, `lage` (Himmelsrichtung des Meeres bzw. Flussachse), `gelaende` (`gras`, `wueste`, `eis`, `gebirge`), `viertel`, `orte`. Viertel (Grenzen und Namen), Tore und Straßen werden gezeichnet; Häuser (Raster je Viertel ausgerichtet, außen locker an den Straßen) und Orte als dunkle Gebäude mit Namen.

## Technik
TypeScript, Vite, Vitest. Eigener Algorithmus, **kein** Code aus TownGeneratorOS (GPLv3) übernommen.

## Befehle
- `npm install`
- `npm run dev` (Vorschau im Browser)
- `npm run check` (Typprüfung und Tests)

## Stand
Umriss (Mauer, Fluss, Küste) und SVG-Renderer im Stil der Vorlage, Laden der Stadt-JSON. Viertel (Voronoi), Tore und Straßen. Nächste Schritte: Brücken, Feinschliff der Beschriftung.
