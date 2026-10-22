# Glasnacht-Stadtgenerator – Arbeitsregeln

- Sprache: **Deutsch**, auch in Kommentaren und Commit-Nachrichten.
- Claude schlägt vor, Marco entscheidet. Offene Fragen nacheinander mit Empfehlung stellen.
- Commits direkt auf `main`, kleine Schritte, vorher `npm run check` grün.
- Eigener Algorithmus. Kein Code aus TownGeneratorOS übernehmen (GPLv3).
- Stil der Karten: `docs/Stilvorlage.md` und `docs/stilvorlage_fenwell_market.png`.
- Alles Zufällige läuft über `src/rng.ts`, nie `Math.random()`.
