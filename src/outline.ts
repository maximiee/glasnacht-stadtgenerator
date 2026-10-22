import { HEIGHT, WIDTH, inPolygon, offsetLine, smoothLine, type Point } from './geometry';
import { createRng, type Rng } from './rng';

export type Wasser = 'fluss' | 'kueste' | 'keins';

export interface UmrissOptionen {
  seed: string | number;
  wasser?: Wasser;
  /** Mauerradius in Metern (Maßstab 1 Einheit = 1 m). */
  radius?: number;
  mauer?: boolean;
}

export interface Umriss {
  seed: string | number;
  mitte: Point;
  /** Geschlossener Mauerring, bei Küste ein offener Bogen (Land-Seite). */
  mauer: Point[] | null;
  mauerGeschlossen: boolean;
  /** Fluss als Fläche (geschlossenes Polygon) und Mittellinie. */
  fluss: { flaeche: Point[]; mittellinie: Point[] } | null;
  /** Meer als geschlossenes Polygon. */
  meer: Point[] | null;
}

const MITTE: Point = { x: WIDTH / 2, y: HEIGHT / 2 };

function wasserlinie(rng: Rng, von: Point, bis: Point, wellen: number, ampl: number): Point[] {
  const n = 9;
  const dx = bis.x - von.x;
  const dy = bis.y - von.y;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const phase = rng() * Math.PI * 2;
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const o = Math.sin(t * Math.PI * wellen + phase) * ampl * (0.6 + 0.8 * rng());
    pts.push({ x: von.x + dx * t + nx * o, y: von.y + dy * t + ny * o });
  }
  return smoothLine(pts, 3);
}

function fluss(rng: Rng): Umriss['fluss'] {
  const breite = 50 + rng() * 25;
  const schraeg = (rng() - 0.5) * 360;
  const von = { x: -40, y: MITTE.y - 60 + schraeg * 0.5 + (rng() - 0.5) * 120 };
  const bis = { x: WIDTH + 40, y: MITTE.y - 60 - schraeg * 0.5 + (rng() - 0.5) * 120 };
  const mittellinie = wasserlinie(rng, von, bis, 2 + rng() * 1.5, 70 + rng() * 40);
  const links = offsetLine(mittellinie, breite / 2);
  const rechts = offsetLine(mittellinie, -breite / 2).reverse();
  return { mittellinie, flaeche: [...links, ...rechts] };
}

function meer(rng: Rng): Point[] {
  // Küste an einer der vier Seiten, Meer dahinter.
  const seite = Math.floor(rng() * 4);
  const tief = 260 + rng() * 120;
  const rand = [
    { von: { x: -40, y: tief }, bis: { x: WIDTH + 40, y: tief }, ecken: [{ x: WIDTH + 40, y: -40 }, { x: -40, y: -40 }] },
    { von: { x: WIDTH - tief, y: -40 }, bis: { x: WIDTH - tief, y: HEIGHT + 40 }, ecken: [{ x: WIDTH + 40, y: HEIGHT + 40 }, { x: WIDTH + 40, y: -40 }] },
    { von: { x: WIDTH + 40, y: HEIGHT - tief }, bis: { x: -40, y: HEIGHT - tief }, ecken: [{ x: -40, y: HEIGHT + 40 }, { x: WIDTH + 40, y: HEIGHT + 40 }] },
    { von: { x: tief, y: HEIGHT + 40 }, bis: { x: tief, y: -40 }, ecken: [{ x: -40, y: -40 }, { x: -40, y: HEIGHT + 40 }] },
  ][seite]!;
  const linie = wasserlinie(rng, rand.von, rand.bis, 3 + rng() * 2, 45 + rng() * 30);
  return [...linie, ...rand.ecken];
}

function mauerring(rng: Rng, radius: number): Point[] {
  const harmonische = [2, 3, 5].map(k => ({ k, a: (0.05 + rng() * 0.07) / (k / 2), p: rng() * Math.PI * 2 }));
  const anzahl = 22 + Math.floor(rng() * 8);
  const pts: Point[] = [];
  for (let i = 0; i < anzahl; i++) {
    const w = (i / anzahl) * Math.PI * 2;
    let r = 1;
    for (const h of harmonische) r += h.a * Math.sin(h.k * w + h.p);
    r *= 1 + (rng() - 0.5) * 0.04;
    pts.push({ x: MITTE.x + Math.cos(w) * radius * r, y: MITTE.y + Math.sin(w) * radius * r });
  }
  return pts;
}

/** Erzeugt Umriss der Stadt: Mauer, Fluss oder Küste. Gleicher Seed, gleiches Ergebnis. */
export function erzeugeUmriss(opt: UmrissOptionen): Umriss {
  const rng = createRng(opt.seed);
  const wasser = opt.wasser ?? 'fluss';
  const radius = opt.radius ?? 330;
  const result: Umriss = { seed: opt.seed, mitte: MITTE, mauer: null, mauerGeschlossen: true, fluss: null, meer: null };

  if (wasser === 'fluss') result.fluss = fluss(rng);
  if (wasser === 'kueste') result.meer = meer(rng);

  if (opt.mauer !== false) {
    const ring = mauerring(rng, radius);
    if (result.meer) {
      // Mauer endet am Wasser: Türme im Meer entfallen, der Bogen bleibt offen.
      const land = ring.filter(p => !inPolygon(p, result.meer!));
      if (land.length < ring.length) {
        const start = ring.findIndex((p, i) => !inPolygon(p, result.meer!) && inPolygon(ring[(i + ring.length - 1) % ring.length]!, result.meer!));
        const sortiert = start >= 0 ? [...ring.slice(start), ...ring.slice(0, start)].filter(p => !inPolygon(p, result.meer!)) : land;
        result.mauer = sortiert;
        result.mauerGeschlossen = false;
      } else {
        result.mauer = ring;
      }
    } else {
      result.mauer = ring;
    }
  }
  return result;
}
