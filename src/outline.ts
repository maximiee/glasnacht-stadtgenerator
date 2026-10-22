import { HEIGHT, WIDTH, dist, inPolygon, linieOhnePolygon, linienlaenge, offsetLine, smoothLine, type Point } from './geometry';
import { createRng, type Rng } from './rng';

export type Wasser = 'fluss' | 'kueste' | 'keins';

export interface UmrissOptionen {
  seed: string | number;
  wasser?: Wasser;
  /** Mauerradius in Metern (Maßstab 1 Einheit = 1 m). */
  radius?: number;
  mauer?: boolean;
  /**
   * Lage des Wassers. Bei Küste die Himmelsrichtung des Meeres (z. B. `west`, `nordost`),
   * bei Fluss die Achse (z. B. `nord-sued`, `west-ost`). Ohne Angabe würfelt der Seed.
   */
  lage?: string;
  /** Zahl der Tore (Standard 3). */
  tore?: number;
}

export interface Umriss {
  seed: string | number;
  mitte: Point;
  /**
   * Mauerstücke. Ohne Wasser ein geschlossener Ring, sonst offene Stücke, die am Ufer enden
   * (Küste: ein Bogen von Ufer zu Ufer, Fluss: Lücke an der Flussbreite).
   */
  mauer: { punkte: Point[]; geschlossen: boolean }[] | null;
  /** Bebautes Stadtgebiet (immer geschlossen, auch ohne Mauer oder bei Küste). */
  innen: Point[];
  /** Tore: Punkte auf der Mauer bzw. am Stadtrand. */
  tore: Point[];
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

/** Winkel in Radiant (0 = Osten, y nach unten, also Norden = -90°). */
const RICHTUNG: Record<string, number> = { ost: 0, suedost: 45, sued: 90, suedwest: 135, west: 180, nordwest: 225, nord: 270, nordost: 315 };

export function richtungswinkel(wort: string | undefined): number | null {
  const w = wort?.toLowerCase().replace(/[ü]/g, 'ue');
  return w !== undefined && w in RICHTUNG ? (RICHTUNG[w]! * Math.PI) / 180 : null;
}

/** Flussachse aus `nord-sued`, `west-ost` usw. Die Achse hat keine Richtung, 0 bis 180°. */
function achsenwinkel(wort: string | undefined): number | null {
  const teile = wort?.toLowerCase().replace(/ü/g, 'ue').split('-');
  const a = richtungswinkel(teile?.[0]);
  return a === null ? null : a % Math.PI;
}

function fluss(rng: Rng, lage: string | undefined): Umriss['fluss'] {
  const breite = 50 + rng() * 25;
  const achse = achsenwinkel(lage) ?? rng() * Math.PI;
  const dx = Math.cos(achse);
  const dy = Math.sin(achse);
  const seitlich = (rng() - 0.5) * 120;
  const mitte = { x: MITTE.x - dy * seitlich, y: MITTE.y + dx * seitlich };
  const von = { x: mitte.x - dx * 1000, y: mitte.y - dy * 1000 };
  const bis = { x: mitte.x + dx * 1000, y: mitte.y + dy * 1000 };
  const mittellinie = wasserlinie(rng, von, bis, 2 + rng() * 1.5, 70 + rng() * 40);
  const links = offsetLine(mittellinie, breite / 2);
  const rechts = offsetLine(mittellinie, -breite / 2).reverse();
  return { mittellinie, flaeche: [...links, ...rechts] };
}

/** Meer in der gegebenen Himmelsrichtung, die Küste läuft quer dazu am Stadtrand entlang. */
function meer(rng: Rng, lage: string | undefined, radius: number): Point[] {
  const winkel = richtungswinkel(lage) ?? Math.floor(rng() * 4) * (Math.PI / 2);
  const dx = Math.cos(winkel);
  const dy = Math.sin(winkel);
  const abstand = radius * 0.85 + rng() * 30;
  const fuss = { x: MITTE.x + dx * abstand, y: MITTE.y + dy * abstand };
  const von = { x: fuss.x + dy * 1100, y: fuss.y - dx * 1100 };
  const bis = { x: fuss.x - dy * 1100, y: fuss.y + dx * 1100 };
  const linie = wasserlinie(rng, von, bis, 3 + rng() * 2, 45 + rng() * 30);
  const tief = 2500;
  return [...linie, { x: bis.x + dx * tief, y: bis.y + dy * tief }, { x: von.x + dx * tief, y: von.y + dy * tief }];
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

/** Schneidet den Mauerring an Meer und Fluss auf: Die Mauer läuft bis ans Wasser und endet dort. */
function mauerStuecke(ring: Point[], wasser: (Point[] | null)[]): { punkte: Point[]; geschlossen: boolean }[] {
  let stuecke: Point[][] = [[...ring, ring[0]!]];
  let geschnitten = false;
  for (const w of wasser) {
    if (!w) continue;
    const neu = stuecke.flatMap(st => linieOhnePolygon(st, w));
    if (neu.length !== 1 || dist(neu[0]![0]!, neu[0]![neu[0]!.length - 1]!) > 0.5 || neu[0]!.length !== stuecke[0]!.length) geschnitten = true;
    stuecke = neu;
    // Beginnt der Ring an Land, hängen erstes und letztes Stück zusammen.
    if (stuecke.length > 1 && dist(stuecke[0]![0]!, stuecke[stuecke.length - 1]![stuecke[stuecke.length - 1]!.length - 1]!) < 0.5) {
      const letztes = stuecke.pop()!;
      stuecke[0] = [...letztes, ...stuecke[0]!.slice(1)];
    }
  }
  if (!geschnitten) return [{ punkte: ring, geschlossen: true }];
  return stuecke.filter(st => linienlaenge(st) > 40).map(punkte => ({ punkte, geschlossen: false }));
}

/** Erzeugt Umriss der Stadt: Mauer, Fluss oder Küste. Gleicher Seed, gleiches Ergebnis. */
export function erzeugeUmriss(opt: UmrissOptionen): Umriss {
  const rng = createRng(opt.seed);
  const wasser = opt.wasser ?? 'fluss';
  const radius = opt.radius ?? 330;
  const result: Umriss = { seed: opt.seed, mitte: MITTE, mauer: null, innen: [], tore: [], fluss: null, meer: null };

  if (wasser === 'fluss') result.fluss = fluss(rng, opt.lage);
  if (wasser === 'kueste') result.meer = meer(rng, opt.lage, radius);

  const ring = mauerring(rng, radius);
  result.innen = ring;
  if (opt.mauer !== false) result.mauer = mauerStuecke(ring, [result.meer, result.fluss?.flaeche ?? null]);
  result.tore = erzeugeTore(rng, ring, [result.meer, result.fluss?.flaeche ?? null], opt.tore ?? 3);
  return result;
}

/** Tore auf dem Ring, gleichmäßig verteilt, nicht im Wasser. */
function erzeugeTore(rng: Rng, ring: Point[], wasser: (Point[] | null)[], anzahl: number): Point[] {
  const land = ring.map((p, i) => ({ p, i })).filter(({ p }) => wasser.every(w => !w || !inPolygon(p, w)));
  const tore: Point[] = [];
  if (!land.length || anzahl <= 0) return tore;
  const start = Math.floor(rng() * land.length);
  for (let k = 0; k < Math.min(anzahl, land.length); k++) {
    tore.push(land[(start + Math.round((k * land.length) / anzahl)) % land.length]!.p);
  }
  return tore;
}
