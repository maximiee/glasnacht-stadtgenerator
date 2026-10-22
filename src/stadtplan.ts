import { HEIGHT, WIDTH, dist, inPolygon, smoothLine, type Point } from './geometry';
import { erzeugeUmriss, type Umriss } from './outline';
import { createRng, type Rng } from './rng';
import type { StadtDatei } from './stadt';
import { erzeugeViertel, type ViertelZelle } from './viertel';

export interface Stadtplan extends Umriss {
  name: string;
  viertel: ViertelZelle[];
  grenzen: [Point, Point][];
  /** Straßen als Linienzüge, von der Mitte durch die Tore nach außen. */
  strassen: Point[][];
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

export function erzeugeStadtplan(s: StadtDatei): Stadtplan {
  const seed = s.seed ?? s.name;
  const umriss = erzeugeUmriss({ seed, wasser: s.wasser, radius: s.radius, mauer: s.mauer, tore: s.tore });
  // Eigene Zufallsfolgen, damit der Umriss gleich bleibt, wenn Viertel oder Straßen sich ändern.
  const { zellen, grenzen } = erzeugeViertel(createRng(`${seed}#viertel`), umriss.innen, umriss.mitte, s.viertel ?? []);

  const rng = createRng(`${seed}#strassen`);
  const strassen: Point[][] = [];
  for (const tor of umriss.tore) {
    const raus = dist(umriss.mitte, tor);
    const richtung = { x: (tor.x - umriss.mitte.x) / raus, y: (tor.y - umriss.mitte.y) / raus };
    const ende = { x: tor.x + richtung.x * 2000, y: tor.y + richtung.y * 2000 };
    // Außen enden Straßen am Kartenrand.
    const rand = { x: Math.min(WIDTH, Math.max(0, ende.x)), y: Math.min(HEIGHT, Math.max(0, ende.y)) };
    const innen = strasse(rng, umriss.mitte, tor);
    const aussen = strasse(rng, tor, rand);
    strassen.push(ohneMeer([...innen, ...aussen.slice(1)], umriss.meer));
  }
  return { ...umriss, name: s.name, viertel: zellen, grenzen, strassen };
}
