import { HEIGHT, WIDTH, dist, distZuLinie, inPolygon, smoothLine, type Point } from './geometry';
import { erzeugeUmriss, type Umriss } from './outline';
import { createRng, type Rng } from './rng';
import { meterProEinheit, radiusFuer, type Gelaende, type StadtDatei } from './stadt';
import { erzeugeHaeuser, type Haus } from './haeuser';
import { setzeOrte, type OrtMarke } from './orte';
import { erzeugeFelder, erzeugeHafen, erzeugePlaetzeUndParks, grenzenOhne, kuestenlinie, type Feld, type Hafen, type Park, type Platz } from './ausstattung';
import { erzeugeViertel, type ViertelZelle } from './viertel';

export interface Stadtplan extends Umriss {
  name: string;
  gelaende: Gelaende;
  /** Maßstab: so viele Meter entsprechen einer Zeichnungseinheit. */
  meterProEinheit: number;
  /** Namen aus der JSON in ihrer Reihenfolge (Viertel, dann Orte): bestimmt die Nummern auf dem Plan. */
  reihenfolge: string[];
  viertel: ViertelZelle[];
  grenzen: [Point, Point][];
  /** Straßen als Linienzüge, von der Mitte durch die Tore nach außen. */
  strassen: Point[][];
  haeuser: Haus[];
  /** Hauptplatz, Ausgangspunkt der Straßen. Liegt nie im Fluss. */
  platz: Point;
  /** Orte der Stadt (aus der JSON) als große Gebäude. */
  orte: OrtMarke[];
  /** Bäume (Gras, Gebirge, Eis) außerhalb der Stadt, in Gruppen. */
  baeume: Point[];
  plaetze: Platz[];
  parks: Park[];
  felder: Feld[];
  /** Nur an der Küste. */
  hafen: Hafen | null;
}

/** Straße von a nach b mit leichtem Schwung. */
function strasse(rng: Rng, a: Point, b: Point): Point[] {
  const n = 6;
  const nx = -(b.y - a.y);
  const ny = b.x - a.x;
  const len = Math.hypot(nx, ny) || 1;
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const o = i === 0 || i === n ? 0 : (rng() - 0.5) * 26;
    pts.push({ x: a.x + (b.x - a.x) * t + (nx / len) * o, y: a.y + (b.y - a.y) * t + (ny / len) * o });
  }
  return smoothLine(pts, 2);
}

/** Schneidet die Linie ab dem ersten Punkt im Meer ab. */
function ohneMeer(linie: Point[], meer: Point[] | null): Point[] {
  if (!meer) return linie;
  const i = linie.findIndex(p => inPolygon(p, meer));
  return i < 0 ? linie : linie.slice(0, i);
}

/** Kürzt eine Straße so, dass sie vor dem Meer endet (mindestens 10 Einheiten Abstand zum Ufer). */
function kuerzeAmUfer(linie: Point[], meer: Point[] | null): Point[] {
  if (!meer) return linie;
  const ufer = kuestenlinie(meer);
  const kurz = [...ohneMeer(linie, meer)];
  while (kurz.length > 2 && distZuLinie(kurz[kurz.length - 1]!, ufer) < 10) kurz.pop();
  return kurz;
}

/** Wahr, wenn die Straße länger als eine Brücke im Fluss verläuft. */
function laengsImFluss(linie: Point[], fluss: Umriss['fluss']): boolean {
  if (!fluss) return false;
  let lauf = 0;
  for (const p of linie) {
    lauf = inPolygon(p, fluss.flaeche) ? lauf + 1 : 0;
    if (lauf > 4) return true;
  }
  return false;
}

/** Baumgruppen außerhalb der Stadt, abseits von Wasser, Straßen und Häusern. */
function streueBaeume(rng: Rng, plan: Stadtplan): Point[] {
  if (plan.gelaende === 'wueste') return [];
  const baeume: Point[] = [];
  const haeuserMitte = plan.haeuser.map(h => ({ x: (h.ecken[0]!.x + h.ecken[2]!.x) / 2, y: (h.ecken[0]!.y + h.ecken[2]!.y) / 2 }));
  const gruppen = 16 + Math.floor(rng() * 8);
  for (let g = 0; g < gruppen; g++) {
    const mitte = { x: 40 + rng() * (WIDTH - 80), y: 40 + rng() * (HEIGHT - 80) };
    const n = 8 + Math.floor(rng() * 14);
    for (let i = 0; i < n; i++) {
      const w = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * 70;
      const p = { x: mitte.x + Math.cos(w) * r, y: mitte.y + Math.sin(w) * r };
      if (p.x < 30 || p.y < 30 || p.x > WIDTH - 30 || p.y > HEIGHT - 30) continue;
      if (inPolygon(p, plan.innen) || distZuLinie(p, plan.innen, true) < 30) continue;
      if (plan.meer && (inPolygon(p, plan.meer) || distZuLinie(p, plan.meer, true) < 16)) continue;
      if (plan.fluss && (inPolygon(p, plan.fluss.flaeche) || distZuLinie(p, plan.fluss.flaeche, true) < 14)) continue;
      if (plan.strassen.some(l => distZuLinie(p, l) < 14)) continue;
      if (haeuserMitte.some(h => dist(h, p) < 16)) continue;
      if (plan.felder.some(fe => dist({ x: (fe.ecken[0]!.x + fe.ecken[2]!.x) / 2, y: (fe.ecken[0]!.y + fe.ecken[2]!.y) / 2 }, p) < 34)) continue;
      if (baeume.some(b => dist(b, p) < 9)) continue;
      baeume.push(p);
    }
  }
  return baeume;
}

/** Verschiebt die Mitte vom Fluss weg, falls dieser zu nah vorbeiläuft. */
function platzAbseitsVomFluss(mitte: Point, fluss: Umriss['fluss']): Point {
  if (!fluss) return mitte;
  const nah = fluss.mittellinie.reduce((b, p) => (dist(p, mitte) < dist(b, mitte) ? p : b));
  const d = dist(nah, mitte);
  if (d > 110) return mitte;
  // Zur Seite schieben, auf der die Mitte schon liegt (bei Gleichstand nach unten).
  const r = d < 1 ? { x: 0, y: 1 } : { x: (mitte.x - nah.x) / d, y: (mitte.y - nah.y) / d };
  return { x: nah.x + r.x * 100, y: nah.y + r.y * 100 };
}

/** Einheitsvektor von der Mitte zum Wasser (Meer oder nächster Flusspunkt), sonst null. */
function richtungZumWasser(u: Umriss): Point | null {
  const ziel = u.meer
    ? { x: u.meer.reduce((a, p) => a + p.x, 0) / u.meer.length, y: u.meer.reduce((a, p) => a + p.y, 0) / u.meer.length }
    : u.fluss?.mittellinie.reduce((b, p) => (dist(p, u.mitte) < dist(b, u.mitte) ? p : b)) ?? null;
  if (!ziel) return null;
  const d = dist(ziel, u.mitte) || 1;
  return { x: (ziel.x - u.mitte.x) / d, y: (ziel.y - u.mitte.y) / d };
}

export function erzeugeStadtplan(s: StadtDatei): Stadtplan {
  const seed = s.seed ?? s.name;
  const umriss = erzeugeUmriss({ seed, wasser: s.wasser, radius: radiusFuer(s), mauer: s.mauer, lage: s.lage, tore: s.tore });
  // Eigene Zufallsfolgen, damit der Umriss gleich bleibt, wenn Viertel oder Straßen sich ändern.
  const { zellen, grenzen } = erzeugeViertel(createRng(`${seed}#viertel`), umriss.innen, umriss.mitte, s.viertel ?? [], richtungZumWasser(umriss));

  const platz = platzAbseitsVomFluss(umriss.mitte, umriss.fluss);
  const rng = createRng(`${seed}#strassen`);
  const strassen: Point[][] = [];
  const genutzt: Point[] = [];

  /** Straße von der Mitte durch das Tor zum Kartenrand, am Meer endet sie kurz vor dem Ufer. */
  const baueStrasse = (tor: Point): Point[] => {
    const raus = dist(platz, tor);
    const richtung = { x: (tor.x - platz.x) / raus, y: (tor.y - platz.y) / raus };
    const ende = { x: tor.x + richtung.x * 2000, y: tor.y + richtung.y * 2000 };
    const rand = { x: Math.min(WIDTH, Math.max(0, ende.x)), y: Math.min(HEIGHT, Math.max(0, ende.y)) };
    const linie = [...strasse(rng, platz, tor), ...strasse(rng, tor, rand).slice(1)];
    return kuerzeAmUfer(linie, umriss.meer);
  };

  for (const tor of umriss.tore) {
    // Läuft die Straße längs im Fluss, wandert das Tor zum Nachbarturm.
    const ring = umriss.innen;
    const start = Math.max(0, ring.findIndex(p => dist(p, tor) < 1));
    const kandidaten = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6].map(k => ring[(start + k + ring.length * 2) % ring.length]!);
    for (const kand of kandidaten) {
      if (umriss.meer && inPolygon(kand, umriss.meer)) continue;
      if (genutzt.some(g => dist(g, kand) < 90)) continue;
      const linie = baueStrasse(kand);
      if (linie.length < 8 || laengsImFluss(linie, umriss.fluss)) continue;
      genutzt.push(kand);
      strassen.push(linie);
      break;
    }
  }
  const plan: Stadtplan = { ...umriss, name: s.name, gelaende: s.gelaende ?? 'gras', meterProEinheit: meterProEinheit(s), reihenfolge: [...(s.viertel ?? []), ...(s.orte ?? [])].map(e => e.name), viertel: zellen, grenzen, strassen, haeuser: [], orte: [], baeume: [], plaetze: [], parks: [], felder: [], hafen: null, platz };
  const einwohner = s.einwohner ?? 15000;
  plan.hafen = erzeugeHafen(createRng(`${seed}#hafen`), plan, einwohner);
  const ausstattung = erzeugePlaetzeUndParks(createRng(`${seed}#plaetze`), plan, einwohner);
  plan.plaetze = ausstattung.plaetze;
  plan.parks = ausstattung.parks;
  // Gassen enden am Wasser und laufen nicht durch Parks und Plätze
  plan.grenzen = grenzenOhne(plan.grenzen, [...(plan.meer ? [plan.meer] : []), ...(plan.fluss ? [plan.fluss.flaeche] : []), ...plan.parks.map(p => p.ecken), ...plan.plaetze.map(p => p.ecken)]);
  plan.haeuser = erzeugeHaeuser(createRng(`${seed}#haeuser`), plan);
  const gesetzt = setzeOrte(createRng(`${seed}#orte`), s.orte ?? [], zellen, plan.haeuser, plan);
  plan.haeuser = gesetzt.haeuser;
  plan.orte = gesetzt.marken;
  plan.felder = erzeugeFelder(createRng(`${seed}#felder`), plan, radiusFuer(s));
  plan.baeume = streueBaeume(createRng(`${seed}#baeume`), plan);
  return plan;
}
