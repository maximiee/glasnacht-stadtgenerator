import { HEIGHT, WIDTH, dist, inPolygon, streckeInPolygon, type Point } from './geometry';
import type { Rng } from './rng';

export interface ViertelZelle {
  name: string;
  mitte: Point;
  polygon: Point[];
}

import type { ViertelLage } from './stadt';

type Lage = ViertelLage;

/** Schneidet ein konvexes Polygon an der Halbebene, die näher an `p` als an `q` liegt. */
function beschneide(poly: Point[], p: Point, q: Point): Point[] {
  const nx = q.x - p.x;
  const ny = q.y - p.y;
  const c = (nx * (p.x + q.x) + ny * (p.y + q.y)) / 2;
  const innen = (v: Point) => nx * v.x + ny * v.y <= c;
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const ia = innen(a);
    const ib = innen(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const da = nx * a.x + ny * a.y - c;
      const db = nx * b.x + ny * b.y - c;
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

export function voronoiZellen(sites: Point[]): Point[][] {
  const box: Point[] = [{ x: -100, y: -100 }, { x: WIDTH + 100, y: -100 }, { x: WIDTH + 100, y: HEIGHT + 100 }, { x: -100, y: HEIGHT + 100 }];
  return sites.map((s, i) => sites.reduce((poly, q, j) => (i === j || poly.length < 3 ? poly : beschneide(poly, s, q)), box));
}

/** Gut verteilte Mittelpunkte im Stadtgebiet (Best-Candidate-Verfahren). */
function streuePunkte(rng: Rng, innen: Point[], n: number): Point[] {
  const xs = innen.map(p => p.x);
  const ys = innen.map(p => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const zufall = (): Point => {
    for (;;) {
      const p = { x: x0 + rng() * (x1 - x0), y: y0 + rng() * (y1 - y0) };
      if (inPolygon(p, innen)) return p;
    }
  };
  const pts: Point[] = [zufall()];
  while (pts.length < n) {
    let beste = zufall();
    let bestD = -1;
    for (let k = 0; k < 24; k++) {
      const c = zufall();
      const d = Math.min(...pts.map(p => dist(p, c)));
      if (d > bestD) { bestD = d; beste = c; }
    }
    pts.push(beste);
  }
  return pts;
}

const W = 0.45;
const LAGE_ZIEL: Record<Exclude<Lage, 'wasser'>, [number, number]> = {
  nord: [0, -0.6], sued: [0, 0.6], ost: [0.6, 0], west: [-0.6, 0],
  nordost: [W, -W], nordwest: [-W, -W], suedost: [W, W], suedwest: [-W, W],
  mitte: [0, 0], aussen: [0.9, 0.9],
};

/**
 * Teilt das Stadtgebiet in Viertel. Namen mit `lage` bekommen das Viertel, das dem Ziel am nächsten liegt,
 * die übrigen Namen werden in Reihenfolge auf die restlichen Zellen verteilt.
 */
export function erzeugeViertel(rng: Rng, innen: Point[], mitte: Point, viertel: { name: string; lage?: Lage }[], zumWasser: Point | null = null): { zellen: ViertelZelle[]; grenzen: [Point, Point][] } {
  const n = Math.max(viertel.length + 3, 7);
  const sites = streuePunkte(rng, innen, n);
  const polys = voronoiZellen(sites);
  const radius = Math.max(...innen.map(p => dist(p, mitte)));

  const frei = new Set(sites.map((_, i) => i));
  const zuordnung = new Map<number, string>();
  const ohneLage: string[] = [];
  let amWasser = 0;
  for (const v of viertel) {
    if (!v.lage) { ohneLage.push(v.name); continue; }
    let [zx, zy] = LAGE_ZIEL.aussen;
    if (v.lage !== 'wasser') [zx, zy] = LAGE_ZIEL[v.lage];
    else if (zumWasser) {
      // Mehrere Viertel am Wasser verteilen sich entlang der Uferlinie.
      const seite = (amWasser % 2 ? 1 : -1) * Math.ceil(amWasser / 2) * 0.4;
      zx = zumWasser.x * 0.7 - zumWasser.y * seite;
      zy = zumWasser.y * 0.7 + zumWasser.x * seite;
      amWasser++;
    }
    const ziel = { x: mitte.x + zx * radius, y: mitte.y + zy * radius };
    const best = [...frei].sort((a, b) => dist(sites[a]!, ziel) - dist(sites[b]!, ziel))[0];
    if (best === undefined) { ohneLage.push(v.name); continue; }
    frei.delete(best);
    zuordnung.set(best, v.name);
  }
  for (const i of [...frei]) {
    const name = ohneLage.shift();
    if (name) zuordnung.set(i, name);
  }

  const zellen: ViertelZelle[] = sites.map((s, i) => ({ name: zuordnung.get(i) ?? '', mitte: s, polygon: polys[i]! }));

  // Grenzen: Zellkanten, die im Stadtgebiet liegen. Doppelte Kanten stören beim Zeichnen nicht.
  const grenzen: [Point, Point][] = [];
  for (const z of zellen) {
    for (let k = 0; k < z.polygon.length; k++) {
      grenzen.push(...streckeInPolygon(z.polygon[k]!, z.polygon[(k + 1) % z.polygon.length]!, innen));
    }
  }
  return { zellen, grenzen };
}
