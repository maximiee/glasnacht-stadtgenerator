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
