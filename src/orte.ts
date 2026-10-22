import { dist, distZuLinie, type Point } from './geometry';
import type { Haus } from './haeuser';
import type { Rng } from './rng';
import type { ViertelZelle } from './viertel';

export interface OrtMarke {
  name: string;
  mitte: Point;
  /** Großes Gebäude als Grundriss. */
  ecken: Point[];
}

const mittelpunkt = (h: Haus): Point => ({
  x: h.ecken.reduce((s, e) => s + e.x, 0) / h.ecken.length,
  y: h.ecken.reduce((s, e) => s + e.y, 0) / h.ecken.length,
});

/**
 * Setzt jeden Ort als großes Gebäude in sein Viertel (Angabe `viertel`, sonst reihum).
 * Häuser in der Nähe weichen. Liegt kein Haus im Viertel, wird der Ort nicht gesetzt.
 */
export function setzeOrte(rng: Rng, orte: { name: string; viertel?: string }[], viertel: ViertelZelle[], haeuser: Haus[], mauer: { punkte: Point[]; geschlossen: boolean }[] | null = null): { marken: OrtMarke[]; haeuser: Haus[] } {
  const mitten = haeuser.map(mittelpunkt);
  const zugehoerig = mitten.map(m => viertel.reduce((b, v, i) => (dist(m, v.mitte) < dist(m, viertel[b]!.mitte) ? i : b), 0));
  const entfernt = new Set<number>();
  const marken: OrtMarke[] = [];

  orte.forEach((ort, n) => {
    let ziel = viertel.findIndex(v => v.name && v.name === ort.viertel);
    if (ziel < 0) ziel = n % viertel.length;
    const kandidaten = mitten
      .map((m, i) => ({ m, i }))
      .filter(({ i }) => zugehoerig[i] === ziel && !entfernt.has(i) && !mauer?.some(m => distZuLinie(mitten[i]!, m.punkte, m.geschlossen) < 30) && !marken.some(k => dist(k.mitte, mitten[i]!) < 40))
      .sort((a, b) => dist(a.m, viertel[ziel]!.mitte) - dist(b.m, viertel[ziel]!.mitte))
      .slice(0, 12);
    const wahl = kandidaten[Math.floor(rng() * kandidaten.length)];
    if (!wahl) return;
    mitten.forEach((m, i) => { if (dist(m, wahl.m) < 13) entfernt.add(i); });
    const e = haeuser[wahl.i]!.ecken;
    const dx = e[1]!.x - e[0]!.x;
    const dy = e[1]!.y - e[0]!.y;
    const l = Math.hypot(dx, dy) || 1;
    const [ux, uy] = [dx / l, dy / l];
    const [bw, bt] = [9, 7];
    const m = wahl.m;
    marken.push({
      name: ort.name,
      mitte: m,
      ecken: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => ({ x: m.x + x! * bw * ux - y! * bt * uy, y: m.y + x! * bw * uy + y! * bt * ux })),
    });
  });
  return { marken, haeuser: haeuser.filter((_, i) => !entfernt.has(i)) };
}
