# Anbindung der Höhlenpläne an die App

Gleiches Muster wie `Anbindung_Gebaeude.md`; nur die Namen ändern sich.

- **Paket:** `liesHoehle`, `erzeugeHoehle`, `hoehleDateiAlsKarte(json)` → `{svg, breite, hoehe, marken[{nr,name,art:'kammer',x,y,kurz}]}`, `KAMMER_ARTEN`, `HOEHLE_MAX_KAMMERN`, `istHoehle`.
- **KI-Werkzeug `hoehle_erschaffen`:** Parameter ist die Höhlen-JSON (Version 1). Fehler von `liesHoehle` sind deutsch und gehen als Werkzeugfehler an die KI zurück, damit sie nachbessert.
- **Spielstand:** `welt.hoehlen` (Name, JSON, Seed), Anzeige/Event `hoehle` analog zu `gebaeude`.
- **Routen:** `GET /api/spielstaende/:id/hoehlen/:nr/bild` (SVG), `.../hoehlen/:nr` (Marken), `POST /api/hoehlenplan` (JSON → SVG).
- **Prompt-Text für die KI:** Kammern mit Namen, Art und `kurz` angeben; `kurz` nie mit Geheimnissen füllen (steht den Spielenden in der Markenliste zur Verfügung). Die Anordnung und Gänge erfindet der Generator, nicht die KI.
- **Kammerarten:** halle, eingang, nische, see, schacht, schatz, lager, brut, quelle, kammer.
