import { createRng, type Rng } from './rng';
import { dist, distZuLinie, smoothLine, type Point } from './geometry';

/**
 * Höhlenpläne: Eingabe als JSON (Glasnacht oder KI), Ausgabe ein Plan mit Kammern, Gängen und Zugang.
 * Maße in Metern, gleicher Seed ergibt dieselbe Höhle.
 */

export const KAMMER_ARTEN = ['halle', 'eingang', 'nische', 'see', 'schacht', 'schatz', 'lager', 'brut', 'quelle', 'kammer'] as const;
export type KammerArt = (typeof KAMMER_ARTEN)[number];

export interface KammerEingabe {
  name: string;
  art?: KammerArt;
  /** Durchmesser in Metern; ohne Angabe nach `art`. */
  durchmesser?: number;
  kurz?: string;
}

export interface HoehleDatei {
  version: 1;
  name: string;
  seed?: string | number;
  gelaende?: 'gras' | 'wueste' | 'eis' | 'gebirge';
  /** Kammern; die erste ist der Zugang von außen, wenn keine `eingang` heißt. */
  kammern: KammerEingabe[];
  /** Feste Verbindungen als Namenspaare; ohne Angabe verbindet der Generator selbst. */
  verbindungen?: [string, string][];
}

export const HOEHLE_MAX_KAMMERN = 16;

const STANDARD_DURCHMESSER: Record<KammerArt, number> = {
  halle: 16, eingang: 9, nische: 5, see: 14, schacht: 6, schatz: 8, lager: 9, brut: 10, quelle: 7, kammer: 10,
};

export function liesHoehle(json: string | unknown): HoehleDatei {
  const roh = typeof json === 'string' ? JSON.parse(json) : json;
  if (typeof roh !== 'object' || roh === null) throw new Error('Höhlen-JSON muss ein Objekt sein');
  const h = roh as Record<string, unknown>;
  if (h.version !== 1) throw new Error(`Unbekannte Version: ${String(h.version)} (erwartet 1)`);
  if (typeof h.name !== 'string' || !h.name) throw new Error('Feld "name" fehlt');
  if (!Array.isArray(h.kammern) || !h.kammern.length) throw new Error('Feld "kammern" fehlt oder ist leer');
  if (h.kammern.length > HOEHLE_MAX_KAMMERN) throw new Error(`Höchstens ${HOEHLE_MAX_KAMMERN} Kammern`);
  const namen = new Set<string>();
  const kammern = h.kammern.map((k: unknown, i: number): KammerEingabe => {
    const x = k as Record<string, unknown>;
    if (typeof x?.name !== 'string' || !x.name) throw new Error(`Kammer ${i + 1}: "name" fehlt`);
    if (namen.has(x.name)) throw new Error(`Kammer „${x.name}“ kommt doppelt vor`);
    namen.add(x.name);
    if (x.art !== undefined && !KAMMER_ARTEN.includes(x.art as KammerArt)) throw new Error(`Kammer „${x.name}“: "art" muss eines von ${KAMMER_ARTEN.join(', ')} sein`);
    if (x.durchmesser !== undefined && (typeof x.durchmesser !== 'number' || x.durchmesser < 3 || x.durchmesser > 60)) throw new Error(`Kammer „${x.name}“: "durchmesser" muss eine Zahl zwischen 3 und 60 sein`);
    return { name: x.name, art: x.art as KammerArt | undefined, durchmesser: x.durchmesser as number | undefined, kurz: typeof x.kurz === 'string' ? x.kurz : undefined };
  });
  const verbindungen = Array.isArray(h.verbindungen) ? h.verbindungen.map((v: unknown) => {
    if (!Array.isArray(v) || v.length !== 2 || !v.every(n => typeof n === 'string' && namen.has(n))) throw new Error('"verbindungen" besteht aus Paaren von Kammernamen');
    return [v[0], v[1]] as [string, string];
  }) : undefined;
  return { ...(h as unknown as HoehleDatei), kammern, verbindungen };
}

export interface Kammer {
  nr: number;
  name: string;
  art: KammerArt;
  kurz: string;
  mitte: Point;
  /** Mittlerer Radius in Metern. */
  radius: number;
  umriss: Point[];
}

export interface Gang {
  von: number;
  nach: number;
  linie: Point[];
  breite: number;
}

export interface Hoehlenplan {
  name: string;
  gelaende: NonNullable<HoehleDatei['gelaende']>;
  seed: string | number;
  kammern: Kammer[];
  gaenge: Gang[];
  /** Zugang von außen: Linie vom Eingang nach draußen. */
  zugang: Point[];
}

/** Unregelmäßiger Umriss um eine Mitte: Radius schwankt weich zwischen 75 und 120 Prozent. */
function umrissVon(rng: Rng, mitte: Point, radius: number, art: KammerArt): Point[] {
  const n = 22;
  const phase = rng() * Math.PI * 2;
  const stark = art === 'schacht' ? 0.08 : art === 'see' ? 0.18 : 0.28;
  const a1 = rng() * Math.PI * 2;
  const a2 = rng() * Math.PI * 2;
  const ellipse = art === 'halle' || art === 'see' ? 0.78 + rng() * 0.25 : 0.9 + rng() * 0.15;
  const dreh = rng() * Math.PI;
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const w = (i / n) * Math.PI * 2;
    const wobble = 1 + stark * (0.55 * Math.sin(2 * w + a1) + 0.3 * Math.sin(3 * w + a2) + 0.25 * Math.sin(5 * w + phase) + (rng() - 0.5) * 0.35);
    const ex = Math.cos(w - dreh);
    const ey = Math.sin(w - dreh);
    const el = 1 / Math.sqrt((ex * ex) / 1 + (ey * ey) / (ellipse * ellipse));
    const r = radius * wobble * el;
    pts.push({ x: mitte.x + Math.cos(w) * r, y: mitte.y + Math.sin(w) * r });
  }
  return pts;
}

/** Schlängelnder Gang zwischen zwei Rändern. */
function gangLinie(rng: Rng, a: Point, b: Point, ra: number, rb: number): Point[] {
  const d = dist(a, b);
  const ux = (b.x - a.x) / d;
  const uy = (b.y - a.y) / d;
  const start = { x: a.x + ux * ra * 0.6, y: a.y + uy * ra * 0.6 };
  const ende = { x: b.x - ux * rb * 0.6, y: b.y - uy * rb * 0.6 };
  const laenge = dist(start, ende);
  const n = Math.max(2, Math.round(laenge / 5));
  const pts: Point[] = [start];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const versatz = (rng() - 0.5) * Math.min(5, laenge * 0.25) * Math.sin(Math.PI * t) * 2;
    pts.push({ x: start.x + (ende.x - start.x) * t - uy * versatz, y: start.y + (ende.y - start.y) * t + ux * versatz });
  }
  pts.push(ende);
  return smoothLine(pts, 2);
}

export function erzeugeHoehle(h: HoehleDatei): Hoehlenplan {
  const seed = h.seed ?? h.name;
  const rng = createRng(`${seed}#kammern`);
  const rngGang = createRng(`${seed}#gaenge`);
  const rngForm = createRng(`${seed}#form`);
  const eintraege = h.kammern.map(k => ({ ...k, art: k.art ?? 'kammer' }));
  // Der Eingang kommt zuerst, dann die übrigen in Eingabereihenfolge.
  const eingangIdx = Math.max(0, eintraege.findIndex(k => k.art === 'eingang'));
  const reihe = [eingangIdx, ...eintraege.map((_, i) => i).filter(i => i !== eingangIdx)];
  const radius = (k: (typeof eintraege)[number]) => (k.durchmesser ?? STANDARD_DURCHMESSER[k.art]) / 2;

  const pos = new Map<number, Point>();
  const eltern = new Map<number, number>();
  const fest = new Map<number, number[]>();
  for (const [a, b] of h.verbindungen ?? []) {
    const i = eintraege.findIndex(k => k.name === a);
    const j = eintraege.findIndex(k => k.name === b);
    if (i >= 0 && j >= 0) { fest.set(i, [...(fest.get(i) ?? []), j]); fest.set(j, [...(fest.get(j) ?? []), i]); }
  }
  pos.set(reihe[0]!, { x: 0, y: 0 });
  const platziert = [reihe[0]!];
  const frei = (p: Point, r: number, ausser: number[] = []) => platziert.every(i => ausser.includes(i) || dist(pos.get(i)!, p) >= radius(eintraege[i]!) + r + 3.5);
  const gangFrei = (a: Point, b: Point, ausser: number[]) => platziert.every(i => ausser.includes(i) || distZuLinie(pos.get(i)!, [a, b], false) >= radius(eintraege[i]!) * 0.9 + 1.5);
  for (const i of reihe.slice(1)) {
    const r = radius(eintraege[i]!);
    // Elternteil: ein fest verbundener, schon platzierter Raum, sonst meist der zuletzt platzierte, manchmal ein früherer.
    const festEltern = (fest.get(i) ?? []).find(j => pos.has(j));
    const elternIdx = festEltern ?? (rng() < 0.62 ? platziert[platziert.length - 1]! : platziert[Math.floor(rng() * platziert.length)]!);
    const pe = pos.get(elternIdx)!;
    const re = radius(eintraege[elternIdx]!);
    let gewaehlt: Point | null = null;
    for (let versuch = 0; versuch < 240 && !gewaehlt; versuch++) {
      const win = rng() * Math.PI * 2;
      const abstand = re + r + 5 + rng() * 9 + versuch * 0.12;
      const p = { x: pe.x + Math.cos(win) * abstand, y: pe.y + Math.sin(win) * abstand };
      if (frei(p, r, [elternIdx]) && gangFrei(pe, p, [elternIdx])) gewaehlt = p;
    }
    if (!gewaehlt) { const win = rng() * Math.PI * 2; gewaehlt = { x: pe.x + Math.cos(win) * (re + r + 40), y: pe.y + Math.sin(win) * (re + r + 40) }; }
    pos.set(i, gewaehlt);
    eltern.set(i, elternIdx);
    platziert.push(i);
  }

  // Gänge: Baumkanten, dazu feste Verbindungen und einzelne Schleifen zwischen nahen Kammern.
  const kanten = new Map<string, [number, number]>();
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  for (const [i, e] of eltern) kanten.set(key(i, e), [e, i]);
  for (const [i, liste] of fest) for (const j of liste) if (pos.has(i) && pos.has(j)) kanten.set(key(i, j), [i, j]);
  for (const i of platziert) for (const j of platziert) {
    if (i >= j || kanten.has(key(i, j))) continue;
    const d = dist(pos.get(i)!, pos.get(j)!);
    if (d < radius(eintraege[i]!) + radius(eintraege[j]!) + 16 && rngGang() < 0.35 && gangFrei(pos.get(i)!, pos.get(j)!, [i, j])) kanten.set(key(i, j), [i, j]);
  }

  // Nummern nach Eingabereihenfolge (wie die Liste der Räume im Spiel).
  const kammern: Kammer[] = eintraege.map((k, i) => ({
    nr: i + 1, name: k.name, art: k.art, kurz: k.kurz ?? '', mitte: pos.get(i)!, radius: radius(k), umriss: umrissVon(rngForm, pos.get(i)!, radius(k), k.art),
  }));
  const gaenge: Gang[] = [...kanten.values()].map(([a, b]) => ({
    von: a, nach: b,
    linie: gangLinie(rngGang, kammern[a]!.mitte, kammern[b]!.mitte, kammern[a]!.radius, kammern[b]!.radius),
    breite: 2.2 + rngGang() * 1.6,
  }));

  // Zugang: vom Eingang weg, von den übrigen Kammern abgewandt.
  const e = kammern[reihe[0]!]!;
  let sx = 0;
  let sy = 0;
  for (const k of kammern) if (k !== e) { sx += k.mitte.x - e.mitte.x; sy += k.mitte.y - e.mitte.y; }
  const win = Math.atan2(-sy || -1, -sx || 0) + (rng() - 0.5) * 0.6;
  const aussen = { x: e.mitte.x + Math.cos(win) * (e.radius + 20), y: e.mitte.y + Math.sin(win) * (e.radius + 20) };
  const zugang = gangLinie(rngGang, e.mitte, aussen, e.radius * 0.2, 0);

  return { name: h.name, gelaende: h.gelaende ?? 'gras', seed, kammern, gaenge, zugang };
}

