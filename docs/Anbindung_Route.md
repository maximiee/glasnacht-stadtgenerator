# Anbindung der Reiserouten an die App

- **Paket:** `liesRoute`, `routeDateiAlsKarte(json, orte, bild)` → `{svg, breite, hoehe, marken[{nr,name,art:'station',x,y,kurz}], km}`, `istRoute`, `WEG_ARTEN`, `ROUTE_MAX_STATIONEN` (24).
- **Weltkarte:** `bild = {href, breite: 2048, hoehe: 1536}`. Ein `data:`-URI macht das SVG selbstständig (ca. 1 MB je Plan) und funktioniert auch als `<img>`; eine URL (z. B. `/api/karte/grundkarte.jpg`) hält das SVG klein, taugt aber nur inline im DOM, nicht als `<img>`. Empfehlung: Server liefert die Pläne inline im DOM und setzt die URL.
- **Orte:** `orte` aus `Karten/06_orte.json` bauen (`name → {x, y}`); Stationen heißen dann wie die Orte.
- **KI-Werkzeug `route_erschaffen`:** Parameter ist die Routen-JSON. Die KI gibt Orte als `ort` an und Zwischenpunkte nur, wenn sie Küsten oder Gebirge umgehen soll; sie erfindet keine Koordinaten für bekannte Orte. Fehler von `liesRoute`/`erzeugeRoute` sind deutsch und gehen als Werkzeugfehler zurück.
- **Spielstand:** `welt.routen`, Anzeige/Event `route` wie bei Gebäuden und Höhlen; die Marken zeigen `kurz`, daher keine Geheimnisse hineinschreiben.
- **Länge:** `km` ist die Länge des geglätteten Verlaufs in Luftlinie. Reisezeit und Gelände rechnet der Code nach `Welt/07_Regelsystem.md` Abschnitt 8, nicht der Generator.
