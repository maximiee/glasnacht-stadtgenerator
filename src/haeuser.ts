import { WIDTH, HEIGHT, dist, distZuLinie, distZuStrecke, inPolygon, type Point } from './geometry';
import { kuestenlinie } from './ausstattung';
import type { Rng } from './rng';
import type { Stadtplan } from './stadtplan';

export interface Haus {
  /** Eckpunkte des Grundrisses. */
  ecken: Point[];
}

const RASTER = 11;
const PLATZ_RADIUS = 30;

function rechteck(m: Point, breite: number, tiefe: number, winkel: number): Point[] {
  const c = Math.cos(winkel);
  const s = Math.sin(winkel);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => ({
    x: m.x + (x! * breite * c - y! * tiefe * s) / 2,
    y: m.y + (x! * breite * s + y! * tiefe * c) / 2,
  }));
}

/**
 * Setzt Häuser auf ein verzerrtes Raster. Je Viertel ist die Ausrichtung gleich.
 * Frei bleiben Wasser, Straßen, Mauer und der Platz in der Mitte. Außerhalb der Mauer
 * stehen nur noch einzelne Häuser nahe der Straßen.
 */
export function erzeugeHaeuser(rng: Rng, plan: Stadtplan): Haus[] {
  const winkel = plan.viertel.map(() => rng() * Math.PI);
  const ufer = plan.meer ? kuestenlinie(plan.meer) : null;
  const haeuser: Haus[] = [];
  const belegt = new Map<string, Point[]>();
  const schluessel = (x: number, y: number) => `${Math.floor(x / 14)},${Math.floor(y / 14)}`;
  const frei = (p: Point) => {
    const kx = Math.floor(p.x / 14);
    const ky = Math.floor(p.y / 14);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const q of belegt.get(`${kx + dx},${ky + dy}`) ?? []) if (dist(p, q) < RASTER * 0.85) return false;
    }
    return true;
  };

  for (let gx = RASTER; gx < WIDTH; gx += RASTER) {
    for (let gy = RASTER; gy < HEIGHT; gy += RASTER) {
      const p = { x: gx + (rng() - 0.5) * RASTER * 0.7, y: gy + (rng() - 0.5) * RASTER * 0.7 };
      const abstandMitte = dist(p, plan.platz);
      if (abstandMitte < PLATZ_RADIUS) continue;
      if (plan.meer && (inPolygon(p, plan.meer) || distZuLinie(p, ufer!) < 14)) continue;
      if (plan.hafen && distZuLinie(p, plan.hafen.kai) < 16) continue;
      if (plan.plaetze.some(q => dist(p, q.mitte) < q.radius + 9)) continue;
      if (plan.parks.some(q => dist(p, q.mitte) < q.radius * 1.15 + 8)) continue;
      if (plan.fluss && (inPolygon(p, plan.fluss.flaeche) || distZuLinie(p, plan.fluss.flaeche, true) < 10)) continue;

      const innen = inPolygon(p, plan.innen);
      let dichte: number;
      const strasse = Math.min(...plan.strassen.map(l => distZuLinie(p, l)), Infinity);
      if (strasse < 9) continue;
      if (plan.grenzen.some(([a, b]) => distZuStrecke(p, a, b) < 6)) continue;
      if (innen) {
        dichte = 0.92;
      } else {
        const rand = distZuLinie(p, plan.innen, true);
        if (rand > 110 || strasse > 55) continue;
        dichte = 0.5 * (1 - rand / 110);
      }
      if (plan.mauer && plan.mauer.some(m => distZuLinie(p, m.punkte, m.geschlossen) < 17)) continue;
      if (rng() > dichte || !frei(p)) continue;

      let nah = 0;
      let nahD = Infinity;
      plan.viertel.forEach((v, i) => {
        const d = dist(p, v.mitte);
        if (d < nahD) { nahD = d; nah = i; }
      });
      const breite = 6 + rng() * 6;
      const tiefe = 6 + rng() * 5;
      haeuser.push({ ecken: rechteck(p, breite, tiefe, winkel[nah]! + (rng() - 0.5) * 0.12) });
      const k = schluessel(p.x, p.y);
      belegt.set(k, [...(belegt.get(k) ?? []), p]);
    }
  }
  return haeuser;
}
