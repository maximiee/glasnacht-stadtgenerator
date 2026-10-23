import { HEIGHT, WIDTH, inPolygon, type Point } from './geometry';
import type { Stadtplan } from './stadtplan';

export interface Beschriftung {
  zeilen: string[];
  x: number;
  y: number;
  anker: 'middle' | 'start' | 'end';
  art: 'viertel' | 'ort';
  /** Name wie in der Stadt-JSON (die Zeilen sind groß geschrieben bzw. umbrochen). */
  name: string;
  /** Nummer ab 1: erst die Viertel, dann die Orte (wie auf dem Plan und in der Liste der App). */
  nr: number;
  /** Schriftgröße; Viertelnamen werden in kleinen Städten kleiner, damit sie sich nicht überdecken. */
  groesse: number;
  /** Mitte der Nummernmarke links neben dem Namen. */
  marke: Point;
}

interface Rechteck { x0: number; y0: number; x1: number; y1: number }

/** Rechteck eines Namens; Marken sitzen links daneben. */
const MARKE_ABSTAND = 13;

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

function rechteck(zeilen: string[], x: number, y: number, anker: Beschriftung['anker'], art: Beschriftung['art'], skala = 1): Rechteck {
  const s = art === 'viertel' ? skala : 1;
  const w = Math.max(...zeilen.map(z => z.length)) * BREITE[art] * s;
  const h = zeilen.length * ZEILE[art] * s;
  const x0 = anker === 'middle' ? x - w / 2 : anker === 'start' ? x : x - w;
  return { x0, x1: x0 + w, y0: y - ZEILE[art] * s + 4, y1: y - ZEILE[art] * s + 4 + h };
}

/**
 * Legt Viertel- und Ortsnamen so, dass sie sich möglichst nicht überlappen.
 * Viertel haben Vorrang, Orte weichen aus (rechts, links, darüber, darunter).
 */
export function legeBeschriftung(plan: Stadtplan): Beschriftung[] {
  const belegt: Rechteck[] = [];
  // Titel, Maßstab, Kompass, Rahmen und Gebäude der Orte sind Hindernisse.
  belegt.push({ x0: WIDTH / 2 - 210, y0: 0, x1: WIDTH / 2 + 210, y1: 110 }, { x0: 0, y0: HEIGHT - 120, x1: 330, y1: HEIGHT }, { x0: WIDTH - 170, y0: HEIGHT - 170, x1: WIDTH, y1: HEIGHT });
  for (const st of plan.hafen?.stege ?? []) {
    const xs = st.ecken.map(e => e.x);
    const ys = st.ecken.map(e => e.y);
    belegt.push({ x0: Math.min(...xs) - 4, y0: Math.min(...ys) - 4, x1: Math.max(...xs) + 4, y1: Math.max(...ys) + 4 });
  }
  for (const sc of plan.hafen?.schiffe ?? []) belegt.push({ x0: sc.mitte.x - sc.laenge / 2, y0: sc.mitte.y - sc.laenge / 2, x1: sc.mitte.x + sc.laenge / 2, y1: sc.mitte.y + sc.laenge / 2 });
  for (const o of plan.orte) { const h = o.art === 'burg' ? 32 : 11; belegt.push({ x0: o.mitte.x - h, y0: o.mitte.y - h * 0.8, x1: o.mitte.x + h, y1: o.mitte.y + h * 0.8 }); }
  const out: Beschriftung[] = [];
  // Kleine Städte: kleinere Viertelnamen (Ausdehnung der Stadt gegen 380 Einheiten).
  const ausdehnung = Math.max(...plan.innen.map(p => Math.hypot(p.x - plan.mitte.x, p.y - plan.mitte.y)));
  const skala = Math.min(1, Math.max(0.62, ausdehnung / 380));

  const versuche = (basis: Point, kandidaten: [number, number, Beschriftung['anker']][], zeilen: string[], art: Beschriftung['art'], imStadtgebiet: boolean, name: string) => {
    let wahl: { x: number; y: number; anker: Beschriftung['anker']; r: Rechteck } | null = null;
    for (const strikt of [true, false]) for (const [dx, dy, anker] of kandidaten) {
      if (wahl) break;
      const x = basis.x + dx;
      const y = basis.y + dy;
      const r = rechteck(zeilen, x, y, anker, art, skala);
      const mitte = { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 };
      if (belegt.some(b => schneidet(r, b))) continue;
      if (imStadtgebiet && !inPolygon(mitte, plan.innen)) continue;
      // Erster Durchgang: Name samt Marke ganz innerhalb der Stadtmauer, nicht über Mauer oder Rand.
      if (strikt && imStadtgebiet && ![{ x: r.x0 - 2 * MARKE_ABSTAND, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x0 - 2 * MARKE_ABSTAND, y: r.y1 }, { x: r.x1, y: r.y1 }].every(q => inPolygon(q, plan.innen))) continue;
      // Keine Namen auf dem Wasser (Mitte und Ecken prüfen)
      const wasser = [plan.meer, plan.fluss?.flaeche ?? null];
      if (art === 'viertel' && [mitte, { x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x0, y: r.y1 }, { x: r.x1, y: r.y1 }].some(q => wasser.some(w => w && inPolygon(q, w)))) continue;
      wahl = { x, y, anker, r };
    }
    if (!wahl) {
      // Nichts frei: lieber ein Name über einem anderen als auf dem Wasser oder außerhalb der Stadt.
      const wasser = [plan.meer, plan.fluss?.flaeche ?? null];
      const bewertet = kandidaten.map(([dx, dy, anker]) => {
        const r = rechteck(zeilen, basis.x + dx, basis.y + dy, anker, art, skala);
        const ecken = [{ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 }, { x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x0, y: r.y1 }, { x: r.x1, y: r.y1 }];
        const imWasser = art === 'viertel' && ecken.some(q => wasser.some(w => w && inPolygon(q, w)));
        const draussen = imStadtgebiet && !inPolygon(ecken[0]!, plan.innen);
        const ueberlappt = belegt.filter(b => schneidet(r, b)).length;
        return { dx, dy, anker, r, punkte: (imWasser ? 1000 : 0) + (draussen ? 100 : 0) + ueberlappt };
      });
      const best = bewertet.reduce((a, b) => (b.punkte < a.punkte ? b : a));
      wahl = { x: basis.x + best.dx, y: basis.y + best.dy, anker: best.anker, r: best.r };
    }
    // Die Marke bekommt Platz links vom Namen, damit sie nichts verdeckt.
    const s = art === 'viertel' ? skala : 1;
    const marke = { x: wahl.r.x0 - MARKE_ABSTAND * s, y: wahl.r.y0 + (ZEILE[art] * s) / 2 + 1 };
    belegt.push({ ...wahl.r, x0: wahl.r.x0 - 2 * MARKE_ABSTAND });
    out.push({ zeilen, x: wahl.x, y: wahl.y, anker: wahl.anker, art, name, nr: out.length + 1, marke, groesse: art === 'viertel' ? 19 * skala : 13 });
  };

  const vOff: [number, number, Beschriftung['anker']][] = [[0, 0, 'middle'], [0, -28, 'middle'], [0, 28, 'middle'], [-60, 0, 'middle'], [60, 0, 'middle'], [0, -56, 'middle'], [0, 56, 'middle'], [-60, -28, 'middle'], [60, 28, 'middle'], [-60, 28, 'middle'], [60, -28, 'middle']];
  // Weitere Plätze rund um die Zelle, nach Abstand sortiert, falls die ersten besetzt sind.
  const raster: [number, number, Beschriftung['anker']][] = [];
  for (const dx of [-120, -80, -40, 0, 40, 80, 120]) for (const dy of [-90, -60, -30, 0, 30, 60, 90]) raster.push([dx, dy, 'middle']);
  raster.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
  const rang = (name: string) => { const i = plan.reihenfolge.indexOf(name); return i < 0 ? 1e6 : i; };
  for (const v of [...plan.viertel].sort((a, b) => rang(a.name) - rang(b.name))) if (v.name) {
    // Liegt der Name am Rand, rückt er in Richtung Stadtmitte.
    // Liegt die Mitte der Zelle im Wasser (Küsten- und Flussviertel), geht der Name zuerst an Land.
    const imWasser = (q: Point) => [plan.meer, plan.fluss?.flaeche ?? null].some(w => w && inPolygon(q, w));
    let basis = v.mitte;
    for (let i = 0; i < 80 && imWasser(basis); i++) {
      const e = Math.hypot(plan.mitte.x - basis.x, plan.mitte.y - basis.y) || 1;
      basis = { x: basis.x + (plan.mitte.x - basis.x) / e * 8, y: basis.y + (plan.mitte.y - basis.y) / e * 8 };
    }
    const d = Math.hypot(plan.mitte.x - basis.x, plan.mitte.y - basis.y) || 1;
    const zurMitte = [30, 60, 90, 120].map((s): [number, number, Beschriftung['anker']] => [Math.round((plan.mitte.x - basis.x) / d * s), Math.round((plan.mitte.y - basis.y) / d * s), 'middle']);
    versuche(basis, [...vOff, ...zurMitte, ...raster], umbrechen(v.name.toUpperCase(), 14), 'viertel', true, v.name);
  }

  for (const o of [...plan.orte].sort((a, b) => rang(a.name) - rang(b.name))) {
    const z = umbrechen(o.name, 24);
    const d = o.art === 'burg' ? 34 : 14;
    versuche(o.mitte, [[d, 4, 'start'], [-d, 4, 'end'], [0, -d, 'middle'], [0, d + 12, 'middle'], [d, -12, 'start'], [-d, -12, 'end'], [d, 20, 'start'], [-d, 20, 'end']], z, 'ort', false, o.name);
  }
  return out;
}
