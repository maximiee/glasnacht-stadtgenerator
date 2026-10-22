# Glasnacht-Stadtgenerator

Sideprojekt zu [Glasnacht](https://github.com/maximiee/glasnacht): erzeugt Stadtpläne per Seed als SVG, im Stil von Watabous City Generator (siehe `docs/Stilvorlage.md`).

## Ziele
- Gleicher Seed, gleiche Stadt.
- Fluss, Küste, Mauer, Viertel mit festen Namen und Orte (POI) aus den Glasnacht-Städtedaten.
- Ausgabe als SVG, im Browser und per Kommandozeile.

## Technik
TypeScript, Vite, Vitest. Eigener Algorithmus, **kein** Code aus TownGeneratorOS (GPLv3) übernommen.

## Befehle
- `npm install`
- `npm run dev` (Vorschau im Browser)
- `npm run check` (Typprüfung und Tests)

## Stand
Gerüst mit seedbarem Zufallsgenerator. Nächste Schritte: Viertel (Voronoi), Straßen, Gebäude, Fluss, Mauer, SVG-Renderer.
