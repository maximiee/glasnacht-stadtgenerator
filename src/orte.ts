import { dist, distZuLinie, inPolygon, type Point } from './geometry';
import { kuestenlinie } from './ausstattung';
import type { Haus } from './haeuser';
import type { Rng } from './rng';
import type { Stadtplan } from './stadtplan';
import type { ViertelZelle } from './viertel';

export interface OrtMarke {
  name: string;
  mitte: Point;
  art: 'haus' | 'burg';
  /** Grundriss: bei `haus` das große Gebäude, bei `burg` die Außenmauer der Anlage. */
  ecken: Point[];
  /** Nur bei Burgen: Ecktürme und Bergfried. */
  burg?: { tuerme: Point[]; bergfried: Point[] };
}

const BURG = /burg|palast|zitadelle|festung|feste\b|kaiserhof|hof der wächter|schloss/i;

const mittelpunkt = (h: Haus): Point => ({
  x: h.ecken.reduce((s, e) => s + e.x, 0) / h.ecken.length,
  y: h.ecken.reduce((s, e) => s + e.y, 0) / h.ecken.length,
});

function drehe(m: Point, ux: number, uy: number, bw: number, bt: number): Point[] {
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => ({ x: m.x + x! * bw * ux - y! * bt * uy, y: m.y + x! * bw * uy + y! * bt * ux }));
}

/**
 * Setzt jeden Ort in sein Viertel (Angabe `viertel`, sonst reihum): normale Orte als großes Gebäude,
 * Burgen und Paläste als ummauerte Anlage mit Türmen und Bergfried. Häuser in der Nähe weichen.
 * Burgen halten Abstand zu Mauer, Wasser, Parks und Plätzen, damit sich nichts überlappt.
 */
export function setzeOrte(rng: Rng, orte: { name: string; viertel?: string }[], viertel: ViertelZelle[], haeuser: Haus[], plan: Pick<Stadtplan, 'mauer' | 'meer' | 'fluss' | 'parks' | 'plaetze' | 'innen'>): { marken: OrtMarke[]; haeuser: Haus[] } {
  const mitten = haeuser.map(mittelpunkt);
  const zugehoerig = mitten.map(m => viertel.reduce((b, v, i) => (dist(m, v.mitte) < dist(m, viertel[b]!.mitte) ? i : b), 0));
  const entfernt = new Set<number>();
  const marken: OrtMarke[] = [];
  const ufer = plan.meer ? kuestenlinie(plan.meer) : null;

  const mauerAbstand = (p: Point) => Math.min(...(plan.mauer ?? []).map(m => distZuLinie(p, m.punkte, m.geschlossen)), Infinity);
  const wasserAbstand = (p: Point) => Math.min(ufer ? distZuLinie(p, ufer) : Infinity, plan.fluss ? distZuLinie(p, plan.fluss.flaeche, true) : Infinity);
  const freiFuerBurg = (p: Point) =>
    inPolygon(p, plan.innen) &&
    mauerAbstand(p) > 50 &&
    wasserAbstand(p) > 48 &&
    !(plan.meer && inPolygon(p, plan.meer)) &&
    !(plan.fluss && inPolygon(p, plan.fluss.flaeche)) &&
    plan.parks.every(k => dist(k.mitte, p) > k.radius + 48) &&
    plan.plaetze.every(k => dist(k.mitte, p) > k.radius + 48) &&
    marken.every(k => dist(k.mitte, p) > 85);

  orte.forEach((ort, n) => {
    const burg = BURG.test(ort.name);
    let ziel = viertel.findIndex(v => v.name && v.name === ort.viertel);
    if (ziel < 0) ziel = n % viertel.length;
    const geeignet = (i: number) =>
      !entfernt.has(i) && (burg ? freiFuerBurg(mitten[i]!) : mauerAbstand(mitten[i]!) > 30 && marken.every(k => dist(k.mitte, mitten[i]!) > 40));
    const sortiert = (liste: number[]) =>
      liste.sort((a, b) => dist(mitten[a]!, viertel[ziel]!.mitte) - dist(mitten[b]!, viertel[ziel]!.mitte)).slice(0, 12);
    let kandidaten = sortiert(mitten.map((_, i) => i).filter(i => zugehoerig[i] === ziel && geeignet(i)));
    // Burgen suchen notfalls in der ganzen Stadt
    if (!kandidaten.length && burg) kandidaten = sortiert(mitten.map((_, i) => i).filter(geeignet));
    const wahl = kandidaten[Math.floor(rng() * kandidaten.length)];
    if (wahl === undefined) return;
    const m = mitten[wahl]!;
    const e = haeuser[wahl]!.ecken;
    const l = Math.hypot(e[1]!.x - e[0]!.x, e[1]!.y - e[0]!.y) || 1;
    const [ux, uy] = [(e[1]!.x - e[0]!.x) / l, (e[1]!.y - e[0]!.y) / l];
    mitten.forEach((q, i) => { if (dist(q, m) < (burg ? 42 : 13)) entfernt.add(i); });
    if (burg) {
      const aussen = drehe(m, ux, uy, 26, 19);
      marken.push({ name: ort.name, mitte: m, art: 'burg', ecken: aussen, burg: { tuerme: aussen, bergfried: drehe(m, ux, uy, 9, 7) } });
    } else {
      marken.push({ name: ort.name, mitte: m, art: 'haus', ecken: drehe(m, ux, uy, 9, 7) });
    }
  });
  return { marken, haeuser: haeuser.filter((_, i) => !entfernt.has(i)) };
}
