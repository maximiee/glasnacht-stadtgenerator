import { HEIGHT, WIDTH, dist, inPolygon, smoothLine, type Point } from './geometry';
import { erzeugeUmriss, type Umriss } from './outline';
import { createRng, type Rng } from './rng';
import type { Gelaende, StadtDatei } from './stadt';
import { erzeugeHaeuser, type Haus } from './haeuser';
import { setzeOrte, type OrtMarke } from './orte';
import { erzeugeViertel, type ViertelZelle } from './viertel';

export interface Stadtplan extends Umriss {
  name: string;
  gelaende: Gelaende;
  viertel: ViertelZelle[];
  grenzen: [Point, Point][];
  /** Straßen als Linienzüge, von der Mitte durch die Tore nach außen. */
  strassen: Point[][];
  haeuser: Haus[];
  /** Hauptplatz, Ausgangspunkt der Straßen. Liegt nie im Fluss. */
  platz: Point;
  /** Orte der Stadt (aus der JSON) als große Gebäude. */
  orte: OrtMarke[];
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

/** Verschiebt die Mitte vom Fluss weg, falls dieser zu nah vorbeiläuft. */
function platzAbseitsVomFluss(mitte: Point, fluss: Umriss['fluss']): Point {
  if (!fluss) return mitte;
  const nah = fluss.mittellinie.reduce((b, p) => (dist(p, mitte) < dist(b, mitte) ? p : b));
  const d = dist(nah, mitte);
  if (d > 75) return mitte;
  // Zur Seite schieben, auf der die Mitte schon liegt (bei Gleichstand nach unten).
  const r = d < 1 ? { x: 0, y: 1 } : { x: (mitte.x - nah.x) / d, y: (mitte.y - nah.y) / d };
  return { x: nah.x + r.x * 80, y: nah.y + r.y * 80 };
}

export function erzeugeStadtplan(s: StadtDatei): Stadtplan {
  const seed = s.seed ?? s.name;
  const umriss = erzeugeUmriss({ seed, wasser: s.wasser, radius: s.radius, mauer: s.mauer, lage: s.lage, tore: s.tore });
  // Eigene Zufallsfolgen, damit der Umriss gleich bleibt, wenn Viertel oder Straßen sich ändern.
  const { zellen, grenzen } = erzeugeViertel(createRng(`${seed}#viertel`), umriss.innen, umriss.mitte, s.viertel ?? []);

  const platz = platzAbseitsVomFluss(umriss.mitte, umriss.fluss);
  const rng = createRng(`${seed}#strassen`);
  const strassen: Point[][] = [];
  for (const tor of umriss.tore) {
    const raus = dist(platz, tor);
    const richtung = { x: (tor.x - platz.x) / raus, y: (tor.y - platz.y) / raus };
    const ende = { x: tor.x + richtung.x * 2000, y: tor.y + richtung.y * 2000 };
    // Außen enden Straßen am Kartenrand.
    const rand = { x: Math.min(WIDTH, Math.max(0, ende.x)), y: Math.min(HEIGHT, Math.max(0, ende.y)) };
    const innen = strasse(rng, platz, tor);
    const aussen = strasse(rng, tor, rand);
    strassen.push(ohneMeer([...innen, ...aussen.slice(1)], umriss.meer));
  }
  const plan: Stadtplan = { ...umriss, name: s.name, gelaende: s.gelaende ?? 'gras', viertel: zellen, grenzen, strassen, haeuser: [], orte: [], platz };
  plan.haeuser = erzeugeHaeuser(createRng(`${seed}#haeuser`), plan);
  const gesetzt = setzeOrte(createRng(`${seed}#orte`), s.orte ?? [], zellen, plan.haeuser);
  plan.haeuser = gesetzt.haeuser;
  plan.orte = gesetzt.marken;
  return plan;
}
