import { readFileSync, writeFileSync } from 'node:fs';
import { gebaeudeDateiAlsKarte, hoehleDateiAlsKarte, istGebaeude, istHoehle, istRoute, routeDateiAlsKarte, stadtDateiAlsSvg, type OrtListe } from './index';

const args = process.argv.slice(2);
const wert = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const kartenPfad = wert('--karte');
const ortePfad = wert('--orte');
const [eingabe, ausgabe] = args;
if (!eingabe || !ausgabe) {
  console.error('Aufruf: npm run svg -- <stadt.json> <ausgabe.svg>\n        Routen: ... <route.json> <ausgabe.svg> --karte <Weltkarte.jpg> --orte <06_orte.json>');
  process.exit(1);
}
const text = readFileSync(eingabe, 'utf8');
const json = JSON.parse(text);

/** Weltkarte als data:-URI einbetten; Größe aus dem JPEG-Kopf lesen. */
function ladeKarte(pfad: string) {
  const b = readFileSync(pfad);
  let i = 2;
  while (i < b.length) {
    const m = b[i + 1]!;
    if (m >= 0xc0 && m <= 0xc3) return { href: `data:image/jpeg;base64,${b.toString('base64')}`, hoehe: b.readUInt16BE(i + 5), breite: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error('Kartenbild ist kein JPEG');
}

let svg: string;
if (istRoute(json)) {
  if (!kartenPfad) throw new Error('Für Routen fehlt --karte <Weltkarte.jpg>');
  const orte: OrtListe = {};
  if (ortePfad) for (const o of JSON.parse(readFileSync(ortePfad, 'utf8')).orte) orte[o.name] = { x: o.x, y: o.y };
  svg = routeDateiAlsKarte(json, orte, ladeKarte(kartenPfad)).svg;
} else svg = istHoehle(json) ? hoehleDateiAlsKarte(text).svg : istGebaeude(json) ? gebaeudeDateiAlsKarte(text).svg : stadtDateiAlsSvg(text);
writeFileSync(ausgabe, svg);
console.log(`${ausgabe} geschrieben`);
