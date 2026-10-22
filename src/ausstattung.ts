import { HEIGHT, WIDTH, dist, distZuLinie, inPolygon, offsetLine, streckeInPolygon, type Point } from './geometry';
import type { Rng } from './rng';
import type { Stadtplan } from './stadtplan';

export interface Platz {
  mitte: Point;
  radius: number;
  ecken: Point[];
  art: 'haupt' | 'markt';
}

export interface Park {
  mitte: Point;
  radius: number;
  ecken: Point[];
  baeume: Point[];
  teich: Point[] | null;
  /** Wüste: Palmen und größerer Teich. */
  oase: boolean;
}

export interface Feld {
  ecken: Point[];
  /** Farbvariante 0 bis 2, damit die Flur nicht einheitlich wirkt. */
  ton: number;
}

export interface Steg {
  ecken: Point[];
}

export interface Schiff {
  mitte: Point;
  winkel: number;
  laenge: number;
  breite: number;
}

export interface Hafen {
  /** Kaimauer entlang des Ufers innerhalb der Stadt. */
  kai: Point[];
  stege: Steg[];
  schiffe: Schiff[];
}

/** Unregelmäßiger Umriss (rund, mit leichter Wellung). */
function blob(rng: Rng, mitte: Point, radius: number, ecken = 14, wellung = 0.16): Point[] {
  const k = 2 + Math.floor(rng() * 3);
  const p = rng() * Math.PI * 2;
  return Array.from({ length: ecken }, (_, i) => {
    const w = (i / ecken) * Math.PI * 2;
    const r = radius * (1 + wellung * Math.sin(k * w + p) + (rng() - 0.5) * 0.05);
    return { x: mitte.x + Math.cos(w) * r, y: mitte.y + Math.sin(w) * r };
  });
}

/** Linie in gleichmäßigen Abständen neu abtasten. */
function abtasten(linie: Point[], schritt: number): Point[] {
  const out: Point[] = [linie[0]!];
  let rest = schritt;
  for (let i = 1; i < linie.length; i++) {
    let a = out[out.length - 1]!;
    const b = linie[i]!;
    let d = dist(a, b);
    while (d >= rest) {
      const t = rest / d;
      a = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      out.push(a);
      d = dist(a, b);
      rest = schritt;
    }
    rest -= d;
  }
  return out;
}

export const kuestenlinie = (meer: Point[]): Point[] => meer.slice(0, -2);

/** Abstand eines Punktes zu allen Hindernissen, die Parks und Plätze meiden müssen. */
function abstandZuHindernissen(p: Point, plan: Stadtplan): number {
  let d = Infinity;
  for (const m of plan.mauer ?? []) d = Math.min(d, distZuLinie(p, m.punkte, m.geschlossen));
  if (plan.meer) d = Math.min(d, distZuLinie(p, kuestenlinie(plan.meer)));
  if (plan.fluss) d = Math.min(d, distZuLinie(p, plan.fluss.flaeche, true));
  return d;
}

const GRUENNAMEN = /garten|gärten|park|oase|hain|wiese/i;
const MARKTNAMEN = /markt|platz|basar|hof\b/i;

/** Hauptplatz, Marktplätze (nach Viertelnamen) und Parks bzw. Gärten. Alles bleibt frei von Wasser, Mauer und Straßen. */
export function erzeugePlaetzeUndParks(rng: Rng, plan: Stadtplan, einwohner: number): { plaetze: Platz[]; parks: Park[] } {
  const skala = 0.75 + 0.5 * Math.sqrt(Math.min(einwohner, 80000) / 80000);
  const plaetze: Platz[] = [];
  const parks: Park[] = [];
  const belegt: { mitte: Point; radius: number }[] = [];

  const frei = (p: Point, r: number) =>
    inPolygon(p, plan.innen) &&
    abstandZuHindernissen(p, plan) > r + 12 &&
    belegt.every(b => dist(b.mitte, p) > b.radius + r + 10) &&
    plan.strassen.every(l => distZuLinie(p, l) > r * 0.6 + 4) &&
    (!plan.meer || !inPolygon(p, plan.meer));

  // Hauptplatz am Straßenknoten
  const rHaupt = 30 * skala;
  plaetze.push({ mitte: plan.platz, radius: rHaupt, ecken: blob(rng, plan.platz, rHaupt, 10, 0.07), art: 'haupt' });
  belegt.push({ mitte: plan.platz, radius: rHaupt });

  /** Sucht einen freien Platz nahe `ziel`, bei Misserfolg mit kleinerem Radius. */
  const suche = (ziel: Point, r0: number): { mitte: Point; radius: number } | null => {
    for (const faktor of [1, 0.8, 0.65]) {
      const r = r0 * faktor;
      for (let k = 0; k < 40; k++) {
        const a = rng() * Math.PI * 2;
        const d = k === 0 ? 0 : Math.sqrt(rng()) * (30 + k * 3);
        const p = { x: ziel.x + Math.cos(a) * d, y: ziel.y + Math.sin(a) * d };
        if (r >= 16 && frei(p, r)) return { mitte: p, radius: r };
      }
    }
    return null;
  };

  const markt = plan.viertel.filter(v => v.name && MARKTNAMEN.test(v.name) && !GRUENNAMEN.test(v.name));
  for (const v of markt.slice(0, 3)) {
    const f = suche(v.mitte, 24 * skala);
    if (!f) continue;
    plaetze.push({ ...f, ecken: blob(rng, f.mitte, f.radius, 10, 0.07), art: 'markt' });
    belegt.push(f);
  }

  const benannt = plan.viertel.filter(v => v.name && GRUENNAMEN.test(v.name));
  const parkZiele: Point[] = benannt.map(v => v.mitte);
  const zusatz = Math.min(4, 1 + Math.floor(einwohner / 20000));
  for (const z of [...plan.viertel].sort(() => rng() - 0.5)) {
    if (parkZiele.length >= benannt.length + zusatz) break;
    if (!benannt.includes(z)) parkZiele.push(z.mitte);
  }

  for (const ziel of parkZiele) {
    const f = suche(ziel, (34 + rng() * 18) * skala);
    if (!f) continue;
    const ecken = blob(rng, f.mitte, f.radius, 14, 0.14);
    const baeume: Point[] = [];
    const n = Math.round((f.radius * f.radius) / 90);
    for (let i = 0; i < n; i++) {
      const w = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * f.radius * 0.78;
      const p = { x: f.mitte.x + Math.cos(w) * r, y: f.mitte.y + Math.sin(w) * r };
      if (baeume.every(b => dist(b, p) > 8)) baeume.push(p);
    }
    const oase = plan.gelaende === 'wueste';
    const teich = oase || rng() < 0.5 ? blob(rng, { x: f.mitte.x + (rng() - 0.5) * f.radius * 0.3, y: f.mitte.y + (rng() - 0.5) * f.radius * 0.3 }, f.radius * (oase ? 0.45 : 0.28), 10, 0.2) : null;
    parks.push({ ...f, ecken, baeume: teich ? baeume.filter(b => !inPolygon(b, teich) && distZuLinie(b, teich, true) > 5) : baeume, teich, oase });
    belegt.push(f);
  }
  return { plaetze, parks };
}

/** Kaimauer, Stege und Schiffe an der Küste. Ohne Küste oder ohne Ufer in der Stadt gibt es keinen Hafen. */
export function erzeugeHafen(rng: Rng, plan: Stadtplan, einwohner: number): Hafen | null {
  if (!plan.meer) return null;
  const ufer = abtasten(kuestenlinie(plan.meer), 10);
  // Abschnitt innerhalb der Stadt, mit Abstand zu den Mauerenden
  const enden = (plan.mauer ?? []).flatMap(m => (m.geschlossen ? [] : [m.punkte[0]!, m.punkte[m.punkte.length - 1]!]));
  const abschnitt = ufer.filter(p => inPolygon(p, plan.innen) && enden.every(e => dist(e, p) > 18));
  if (abschnitt.length < 6) return null;

  const links = offsetLine(abschnitt, 5);
  const kai = inPolygon(links[Math.floor(links.length / 2)]!, plan.meer) ? offsetLine(abschnitt, -5) : links;

  const nStege = Math.max(2, Math.min(5, 2 + Math.floor(einwohner / 15000)));
  const stege: Steg[] = [];
  for (let k = 0; k < nStege; k++) {
    const i = Math.min(abschnitt.length - 2, Math.max(1, Math.round(((k + 0.5) / nStege) * (abschnitt.length - 1))));
    const p = abschnitt[i]!;
    const a = abschnitt[i - 1]!;
    const b = abschnitt[i + 1]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const t = { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
    let n = { x: -t.y, y: t.x };
    if (!inPolygon({ x: p.x + n.x * 14, y: p.y + n.y * 14 }, plan.meer)) n = { x: -n.x, y: -n.y };
    const laenge = 32 + rng() * 26;
    const w = 4.5;
    const a0 = { x: p.x - n.x * 5, y: p.y - n.y * 5 };
    const a1 = { x: p.x + n.x * laenge, y: p.y + n.y * laenge };
    stege.push({ ecken: [{ x: a0.x - t.x * w, y: a0.y - t.y * w }, { x: a1.x - t.x * w, y: a1.y - t.y * w }, { x: a1.x + t.x * w, y: a1.y + t.y * w }, { x: a0.x + t.x * w, y: a0.y + t.y * w }] });
  }

  const nSchiffe = Math.max(2, Math.min(8, 2 + Math.floor(einwohner / 10000)));
  const schiffe: Schiff[] = [];
  for (let versuch = 0; versuch < 80 && schiffe.length < nSchiffe; versuch++) {
    const i = Math.floor(rng() * abschnitt.length);
    const p = abschnitt[i]!;
    const a = abschnitt[Math.max(0, i - 1)]!;
    const b = abschnitt[Math.min(abschnitt.length - 1, i + 1)]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const t = { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
    let n = { x: -t.y, y: t.x };
    if (!inPolygon({ x: p.x + n.x * 14, y: p.y + n.y * 14 }, plan.meer)) n = { x: -n.x, y: -n.y };
    const abstand = 55 + rng() * 80;
    const mitte = { x: p.x + n.x * abstand, y: p.y + n.y * abstand };
    const laenge = 26 + rng() * 12;
    if (!inPolygon(mitte, plan.meer) || distZuLinie(mitte, kuestenlinie(plan.meer)) < laenge) continue;
    const stegLinie = (s: Steg): Point[] => [{ x: (s.ecken[0]!.x + s.ecken[3]!.x) / 2, y: (s.ecken[0]!.y + s.ecken[3]!.y) / 2 }, { x: (s.ecken[1]!.x + s.ecken[2]!.x) / 2, y: (s.ecken[1]!.y + s.ecken[2]!.y) / 2 }];
    if (stege.some(s => distZuLinie(mitte, stegLinie(s)) < laenge * 0.6 + 10)) continue;
    if (schiffe.some(s => dist(s.mitte, mitte) < 50)) continue;
    schiffe.push({ mitte, winkel: Math.atan2(t.y, t.x) + (rng() - 0.5) * 0.8, laenge, breite: laenge * 0.32 });
  }
  return { kai, stege, schiffe };
}

/** Schneidet Grenzstrecken weg, die in Wasser, Parks oder Plätzen liegen. */
export function grenzenOhne(grenzen: [Point, Point][], sperr: Point[][]): [Point, Point][] {
  let teile = grenzen;
  for (const poly of sperr) teile = teile.flatMap(([a, b]) => streckeInPolygon(a, b, poly, false));
  return teile;
}

/**
 * Felder rund um die Stadt: Gruppen rechteckiger Parzellen, je Gruppe gleich ausgerichtet.
 * Sie liegen außerhalb der Mauer, abseits von Wasser, Straßen und Häusern. In Wüste und Eis gibt es keine.
 */
export function erzeugeFelder(rng: Rng, plan: Stadtplan, radius: number): Feld[] {
  if (plan.gelaende === 'wueste' || plan.gelaende === 'eis') return [];
  const felder: Feld[] = [];
  const mitten = plan.haeuser.map(h => ({ x: (h.ecken[0]!.x + h.ecken[2]!.x) / 2, y: (h.ecken[0]!.y + h.ecken[2]!.y) / 2 }));
  const gruppen = plan.gelaende === 'gebirge' ? 2 : 4 + Math.floor(rng() * 3);

  const brauchbar = (p: Point) =>
    p.x > 36 && p.y > 36 && p.x < WIDTH - 36 && p.y < HEIGHT - 36 &&
    !inPolygon(p, plan.innen) && distZuLinie(p, plan.innen, true) > 40 &&
    !(plan.meer && (inPolygon(p, plan.meer) || distZuLinie(p, kuestenlinie(plan.meer)) < 16)) &&
    !(plan.fluss && (inPolygon(p, plan.fluss.flaeche) || distZuLinie(p, plan.fluss.flaeche, true) < 14)) &&
    plan.strassen.every(l => distZuLinie(p, l) > 12) &&
    mitten.every(h => dist(h, p) > 18) &&
    (plan.mauer ?? []).every(m => distZuLinie(p, m.punkte, m.geschlossen) > 24);

  for (let g = 0; g < gruppen; g++) {
    const w = rng() * Math.PI * 2;
    const abstand = radius * (1.3 + rng() * 0.7);
    const mitte = { x: plan.mitte.x + Math.cos(w) * abstand, y: plan.mitte.y + Math.sin(w) * abstand };
    const winkel = rng() * Math.PI;
    const [ux, uy] = [Math.cos(winkel), Math.sin(winkel)];
    const bw = 40 + rng() * 22;
    const bt = 26 + rng() * 14;
    for (let i = -4; i <= 4; i++) {
      for (let j = -4; j <= 4; j++) {
        const c = { x: mitte.x + ux * i * bw - uy * j * bt + (rng() - 0.5) * 5, y: mitte.y + uy * i * bw + ux * j * bt + (rng() - 0.5) * 5 };
        if (dist(c, mitte) > 150 || rng() < 0.15) continue;
        const ecken = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => ({ x: c.x + x! * (bw / 2 - 3) * ux - y! * (bt / 2 - 3) * uy, y: c.y + x! * (bw / 2 - 3) * uy + y! * (bt / 2 - 3) * ux }));
        if (![c, ...ecken].every(brauchbar)) continue;
        if (felder.some(f2 => dist(mittelpunkt4(f2.ecken), c) < Math.min(bw, bt) * 0.9)) continue;
        felder.push({ ecken, ton: Math.floor(rng() * 3) });
      }
    }
  }
  return felder;
}

const mittelpunkt4 = (e: Point[]): Point => ({ x: (e[0]!.x + e[2]!.x) / 2, y: (e[0]!.y + e[2]!.y) / 2 });
