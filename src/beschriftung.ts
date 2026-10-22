import { HEIGHT, WIDTH, inPolygon, type Point } from './geometry';
import type { Stadtplan } from './stadtplan';

export interface Beschriftung {
  zeilen: string[];
  x: number;
  y: number;
  anker: 'middle' | 'start' | 'end';
  art: 'viertel' | 'ort';
}

interface Rechteck { x0: number; y0: number; x1: number; y1: number }

const BREITE = { viertel: 16.5, ort: 6.4 };
const ZEILE = { viertel: 22, ort: 15 };

const schneidet = (a: Rechteck, b: Rechteck) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** Bricht lange Namen an der Leerstelle nahe der Mitte um. */
function umbrechen(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const mitte = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) if (text[i] === ' ' && (best < 0 || Math.abs(i - mitte) < Math.abs(best - mitte))) best = i;
  return best < 0 ? [text] : [text.slice(0, best), text.slice(best + 1)];
}

function rechteck(zeilen: string[], x: number, y: number, anker: Beschriftung['anker'], art: Beschriftung['art']): Rechteck {
  const w = Math.max(...zeilen.map(z => z.length)) * BREITE[art];
  const h = zeilen.length * ZEILE[art];
  const x0 = anker === 'middle' ? x - w / 2 : anker === 'start' ? x : x - w;
  return { x0, x1: x0 + w, y0: y - ZEILE[art] + 4, y1: y - ZEILE[art] + 4 + h };
}

/**
 * Legt Viertel- und Ortsnamen so, dass sie sich möglichst nicht überlappen.
 * Viertel haben Vorrang, Orte weichen aus (rechts, links, darüber, darunter).
 */
export function legeBeschriftung(plan: Stadtplan): Beschriftung[] {
  const belegt: Rechteck[] = [];
  // Titel, Maßstab, Kompass, Rahmen und Gebäude der Orte sind Hindernisse.
  belegt.push({ x0: WIDTH / 2 - 210, y0: 0, x1: WIDTH / 2 + 210, y1: 110 }, { x0: 0, y0: HEIGHT - 120, x1: 330, y1: HEIGHT }, { x0: WIDTH - 170, y0: HEIGHT - 170, x1: WIDTH, y1: HEIGHT });
  for (const o of plan.orte) belegt.push({ x0: o.mitte.x - 11, y0: o.mitte.y - 9, x1: o.mitte.x + 11, y1: o.mitte.y + 9 });
  const out: Beschriftung[] = [];

  const versuche = (basis: Point, kandidaten: [number, number, Beschriftung['anker']][], zeilen: string[], art: Beschriftung['art'], imStadtgebiet: boolean) => {
    let wahl: { x: number; y: number; anker: Beschriftung['anker']; r: Rechteck } | null = null;
    for (const [dx, dy, anker] of kandidaten) {
      const x = basis.x + dx;
      const y = basis.y + dy;
      const r = rechteck(zeilen, x, y, anker, art);
      const mitte = { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 };
      if (belegt.some(b => schneidet(r, b))) continue;
      if (imStadtgebiet && !inPolygon(mitte, plan.innen)) continue;
      wahl = { x, y, anker, r };
      break;
    }
    if (!wahl) {
      const [dx, dy, anker] = kandidaten[0]!;
      wahl = { x: basis.x + dx, y: basis.y + dy, anker, r: rechteck(zeilen, basis.x + dx, basis.y + dy, anker, art) };
    }
    belegt.push(wahl.r);
    out.push({ zeilen, x: wahl.x, y: wahl.y, anker: wahl.anker, art });
  };

  const vOff: [number, number, Beschriftung['anker']][] = [[0, 0, 'middle'], [0, -28, 'middle'], [0, 28, 'middle'], [-60, 0, 'middle'], [60, 0, 'middle'], [0, -56, 'middle'], [0, 56, 'middle'], [-60, -28, 'middle'], [60, 28, 'middle'], [-60, 28, 'middle'], [60, -28, 'middle']];
  for (const v of plan.viertel) if (v.name) versuche(v.mitte, vOff, umbrechen(v.name.toUpperCase(), 14), 'viertel', true);

  for (const o of plan.orte) {
    const z = umbrechen(o.name, 24);
    versuche(o.mitte, [[14, 4, 'start'], [-14, 4, 'end'], [0, -14, 'middle'], [0, 26, 'middle'], [14, -12, 'start'], [-14, -12, 'end'], [14, 20, 'start'], [-14, 20, 'end']], z, 'ort', false);
  }
  return out;
}
