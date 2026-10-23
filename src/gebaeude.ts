import { createRng, type Rng } from './rng';

/**
 * Gebäudepläne: Eingabe als JSON (von Glasnacht oder der KI), Ausgabe ein Grundriss mit Räumen, Türen,
 * Fenstern und Möbeln. Alles Maße in Metern. Gleicher Seed ergibt denselben Grundriss.
 */

export const RAUM_ARTEN = [
  'wohnraum', 'schlafraum', 'kueche', 'vorrat', 'werkstatt', 'schankraum', 'laden', 'lager', 'flur', 'halle',
  'altar', 'kammer', 'stall', 'bad', 'keller', 'saal', 'wachraum', 'zelle', 'raum',
] as const;
export type RaumArt = (typeof RAUM_ARTEN)[number];

export interface RaumEingabe {
  name: string;
  art?: RaumArt;
  /** Grundfläche in Quadratmetern; ohne Angabe nach `art`. */
  flaeche?: number;
  kurz?: string;
}

export interface EtageEingabe {
  name?: string;
  raeume: RaumEingabe[];
}

export interface GebaeudeDatei {
  version: 1;
  name: string;
  seed?: string | number;
  /** Nur zur Beschreibung (Wohnhaus, Gasthaus, Tempel ...); der Grundriss folgt den Räumen. */
  typ?: string;
  gelaende?: 'gras' | 'wueste' | 'eis' | 'gebirge';
  /** Etagen von unten nach oben; für ein Stockwerk reicht `raeume`. */
  etagen?: EtageEingabe[];
  raeume?: RaumEingabe[];
}

export const GEBAEUDE_MAX_ETAGEN = 5;
export const GEBAEUDE_MAX_RAEUME = 14;

const STANDARD_FLAECHE: Record<RaumArt, number> = {
  wohnraum: 20, schlafraum: 12, kueche: 14, vorrat: 8, werkstatt: 24, schankraum: 40, laden: 24, lager: 20,
  flur: 8, halle: 60, altar: 36, kammer: 9, stall: 30, bad: 6, keller: 24, saal: 70, wachraum: 18, zelle: 6, raum: 14,
};

/** Prüft ein Gebäude-JSON und liefert es mit Etagen (`raeume` wird zur einen Etage). */
export function liesGebaeude(json: string | unknown): GebaeudeDatei & { etagen: EtageEingabe[] } {
  const roh = typeof json === 'string' ? JSON.parse(json) : json;
  if (typeof roh !== 'object' || roh === null) throw new Error('Gebäude-JSON muss ein Objekt sein');
  const g = roh as Record<string, unknown>;
  if (g.version !== 1) throw new Error(`Unbekannte Version: ${String(g.version)} (erwartet 1)`);
  if (typeof g.name !== 'string' || !g.name) throw new Error('Feld "name" fehlt');
  const etagenRoh = Array.isArray(g.etagen) ? g.etagen : Array.isArray(g.raeume) ? [{ raeume: g.raeume }] : null;
  if (!etagenRoh?.length) throw new Error('Feld "etagen" (oder "raeume") fehlt oder ist leer');
  if (etagenRoh.length > GEBAEUDE_MAX_ETAGEN) throw new Error(`Höchstens ${GEBAEUDE_MAX_ETAGEN} Etagen`);
  const etagen: EtageEingabe[] = etagenRoh.map((e: unknown, i: number) => {
    const raeume = (e as { raeume?: unknown })?.raeume;
    if (!Array.isArray(raeume) || !raeume.length) throw new Error(`Etage ${i + 1}: "raeume" fehlt oder ist leer`);
    if (raeume.length > GEBAEUDE_MAX_RAEUME) throw new Error(`Etage ${i + 1}: höchstens ${GEBAEUDE_MAX_RAEUME} Räume`);
    const namen = new Set<string>();
    return {
      name: typeof (e as { name?: unknown }).name === 'string' ? ((e as { name: string }).name) : undefined,
      raeume: raeume.map((r: unknown, j: number) => {
        const x = r as Record<string, unknown>;
        if (typeof x?.name !== 'string' || !x.name) throw new Error(`Etage ${i + 1}, Raum ${j + 1}: "name" fehlt`);
        if (namen.has(x.name)) throw new Error(`Etage ${i + 1}: Raum „${x.name}“ kommt doppelt vor`);
        namen.add(x.name);
        if (x.art !== undefined && !RAUM_ARTEN.includes(x.art as RaumArt))
          throw new Error(`Raum „${x.name}“: "art" muss eines von ${RAUM_ARTEN.join(', ')} sein`);
        if (x.flaeche !== undefined && (typeof x.flaeche !== 'number' || x.flaeche < 3 || x.flaeche > 400))
          throw new Error(`Raum „${x.name}“: "flaeche" muss eine Zahl zwischen 3 und 400 sein`);
        return { name: x.name, art: x.art as RaumArt | undefined, flaeche: x.flaeche as number | undefined, kurz: typeof x.kurz === 'string' ? x.kurz : undefined };
      }),
    };
  });
  return { ...(g as unknown as GebaeudeDatei), etagen };
}

export interface Rechteck { x: number; y: number; w: number; h: number }

export interface Raum {
  nr: number;
  name: string;
  art: RaumArt;
  kurz: string;
  r: Rechteck;
  /** Treppenhaus: Flur an der Westwand mit Treppe. */
  treppenhaus?: boolean;
}

export interface Tuer { x: number; y: number; waagerecht: boolean; breite: number; aussen: boolean; von: number; nach: number }
export interface Fenster { x: number; y: number; waagerecht: boolean; breite: number }

export interface Etage {
  name: string;
  raeume: Raum[];
  tueren: Tuer[];
  fenster: Fenster[];
}

export interface Gebaeudeplan {
  name: string;
  typ: string;
  gelaende: NonNullable<GebaeudeDatei['gelaende']>;
  breite: number;
  tiefe: number;
  etagen: Etage[];
  seed: string | number;
}

const RASTER = 0.5;
const snap = (v: number) => Math.round(v / RASTER) * RASTER;
const MIN_SEITE = 1.8;
const TREPPE_BREITE = 2.5;
const TREPPE_LAENGE = 3.5;
export const TREPPEN_LAENGE = TREPPE_LAENGE;

const flaecheVon = (r: RaumEingabe) => r.flaeche ?? STANDARD_FLAECHE[r.art ?? 'raum'];

/** Teilt ein Rechteck rekursiv nach Flächen (Treemap), jeder Raum bekommt ein Rechteck. */
function teile(rng: Rng, rect: Rechteck, items: { idx: number; fl: number }[], aus: Map<number, Rechteck>): void {
  if (items.length === 1) { aus.set(items[0]!.idx, rect); return; }
  const sortiert = [...items].sort((a, b) => b.fl - a.fl);
  const a: typeof items = [];
  const b: typeof items = [];
  let sa = 0;
  let sb = 0;
  for (const it of sortiert) { if (sa <= sb) { a.push(it); sa += it.fl; } else { b.push(it); sb += it.fl; } }
  if (!b.length) { b.push(a.pop()!); sb = b[0]!.fl; sa -= sb; }
  // Welche Gruppe zuerst liegt (links/oben), entscheidet der Zufall (Abwechslung zwischen Seeds).
  const aZuerst = rng() < 0.5;
  const anteil = (aZuerst ? sa : sb) / (sa + sb);
  const langwaagerecht = rect.w >= rect.h;
  const versuch = (waagerecht: boolean): [Rechteck, Rechteck] | null => {
    const gesamt = waagerecht ? rect.w : rect.h;
    const schnitt = Math.min(gesamt - MIN_SEITE, Math.max(MIN_SEITE, snap(gesamt * anteil)));
    if (schnitt < MIN_SEITE || gesamt - schnitt < MIN_SEITE) return null;
    return waagerecht
      ? [{ x: rect.x, y: rect.y, w: schnitt, h: rect.h }, { x: rect.x + schnitt, y: rect.y, w: rect.w - schnitt, h: rect.h }]
      : [{ x: rect.x, y: rect.y, w: rect.w, h: schnitt }, { x: rect.x, y: rect.y + schnitt, w: rect.w, h: rect.h - schnitt }];
  };
  const teilung = versuch(langwaagerecht) ?? versuch(!langwaagerecht);
  if (!teilung) {
    // Zu eng: die Räume teilen sich den Platz nach Streifen.
    const waagerecht = rect.w >= rect.h;
    const gesamt = items.reduce((s, i) => s + i.fl, 0);
    let pos = 0;
    for (const it of items) {
      const anteilIt = it.fl / gesamt;
      const laenge = waagerecht ? rect.w * anteilIt : rect.h * anteilIt;
      aus.set(it.idx, waagerecht ? { x: rect.x + pos, y: rect.y, w: laenge, h: rect.h } : { x: rect.x, y: rect.y + pos, w: rect.w, h: laenge });
      pos += laenge;
    }
    return;
  }
  const [ra, rb] = teilung;
  if (aZuerst) { teile(rng, ra, a, aus); teile(rng, rb, b, aus); } else { teile(rng, ra, b, aus); teile(rng, rb, a, aus); }
}

/** Gemeinsame Wand zweier Rechtecke: Lage und Länge, sonst null. */
function gemeinsameWand(p: Rechteck, q: Rechteck): { waagerecht: boolean; fest: number; von: number; bis: number } | null {
  const eps = 1e-6;
  // senkrechte Wand (p rechts von q oder umgekehrt)
  for (const [l, r] of [[p, q], [q, p]] as [Rechteck, Rechteck][]) {
    if (Math.abs(l.x + l.w - r.x) < eps) {
      const von = Math.max(l.y, r.y);
      const bis = Math.min(l.y + l.h, r.y + r.h);
      if (bis - von >= 1.4) return { waagerecht: false, fest: r.x, von, bis };
    }
    if (Math.abs(l.y + l.h - r.y) < eps) {
      const von = Math.max(l.x, r.x);
      const bis = Math.min(l.x + l.w, r.x + r.w);
      if (bis - von >= 1.4) return { waagerecht: true, fest: r.y, von, bis };
    }
  }
  return null;
}

const TUERBREITE = 1.0;

/** Erzeugt den Grundriss: Raumaufteilung, Türen, Fenster. */
export function erzeugeGebaeude(g: ReturnType<typeof liesGebaeude>): Gebaeudeplan {
  const seed = g.seed ?? g.name;
  const mehrere = g.etagen.length > 1;
  // Gemeinsame Grundfläche aller Etagen (ohne Treppenhaus).
  const flaechen = g.etagen.map(e => e.raeume.reduce((s, r) => s + flaecheVon(r), 0));
  const rngUmriss = createRng(`${seed}#umriss`);
  const gesamt = Math.max(...flaechen);
  const seitenverh = 1.15 + rngUmriss() * 0.55;
  let breite = snap(Math.sqrt(gesamt * seitenverh));
  let tiefe = snap(gesamt / breite);
  breite = Math.max(breite, 4);
  tiefe = Math.max(tiefe, 4);
  const streifen = mehrere ? TREPPE_BREITE : 0;
  const gesamtBreite = breite + streifen;

  const etagen: Etage[] = g.etagen.map((e, ei) => {
    const rng = createRng(`${seed}#etage${ei}`);
    const eintraege = e.raeume;
    const rest: Rechteck = { x: streifen, y: 0, w: breite, h: tiefe };
    const items = eintraege.map((r, idx) => ({ idx, fl: flaecheVon(r) }));
    const aus = new Map<number, Rechteck>();
    teile(rng, rest, items, aus);
    const raeume: Raum[] = eintraege.map((r, idx) => ({
      nr: 0,
      name: r.name,
      art: r.art ?? 'raum',
      kurz: r.kurz ?? '',
      r: aus.get(idx)!,
    }));
    if (mehrere) raeume.unshift({ nr: 0, name: 'Treppenhaus', art: 'flur', kurz: 'Die Treppe verbindet die Etagen.', r: { x: 0, y: 0, w: streifen, h: tiefe }, treppenhaus: true });
    raeume.forEach((r, i) => (r.nr = i + 1));

    // Adjazenz und Türen: zufälliger Spannbaum ab dem Eingangsraum, bevorzugt über Flure, dazu einzelne Schleifen.
    const kanten: { a: number; b: number; wand: NonNullable<ReturnType<typeof gemeinsameWand>> }[] = [];
    for (let i = 0; i < raeume.length; i++) for (let j = i + 1; j < raeume.length; j++) {
      const w = gemeinsameWand(raeume[i]!.r, raeume[j]!.r);
      if (w) kanten.push({ a: i, b: j, wand: w });
    }
    const tueren: Tuer[] = [];
    const gewicht = (k: (typeof kanten)[number]) =>
      (raeume[k.a]!.art === 'flur' || raeume[k.b]!.art === 'flur' ? 0.4 : 1) + rng() * 0.8;
    const eingang = ei > 0 ? 0 : (() => {
      const bevorzugt = ['flur', 'schankraum', 'laden', 'halle', 'altar', 'saal', 'wohnraum'];
      const sueden = raeume.map((r, i) => ({ r, i })).filter(({ r }) => Math.abs(r.r.y + r.r.h - tiefe) < 1e-6 && !r.treppenhaus || (r.treppenhaus && ei === 0));
      const kand = sueden.sort((x, y) => bevorzugt.indexOf(x.r.art) - bevorzugt.indexOf(y.r.art) || y.r.r.w - x.r.r.w);
      const nichtLeer = kand.filter(k => bevorzugt.includes(k.r.art));
      return (nichtLeer[0] ?? kand[0] ?? { i: 0 }).i;
    })();
    const besucht = new Set<number>([eingang]);
    const benutzt = new Set<(typeof kanten)[number]>();
    while (besucht.size < raeume.length) {
      const frei = kanten.filter(k => besucht.has(k.a) !== besucht.has(k.b));
      if (!frei.length) break; // nicht zusammenhängend: der Rest bekommt keine Tür (selten)
      const k = frei.reduce((x, y) => (gewicht(x) <= gewicht(y) ? x : y));
      besucht.add(besucht.has(k.a) ? k.b : k.a);
      benutzt.add(k);
    }
    for (const k of kanten) if (!benutzt.has(k) && rng() < 0.18 && raeume[k.a]!.art !== 'zelle' && raeume[k.b]!.art !== 'zelle') benutzt.add(k);
    for (const k of benutzt) {
      const { waagerecht, fest, von, bis } = k.wand;
      const mitte = (von + bis) / 2 + (rng() - 0.5) * Math.max(0, bis - von - TUERBREITE - 0.6);
      const pos = Math.min(bis - TUERBREITE / 2 - 0.3, Math.max(von + TUERBREITE / 2 + 0.3, snap(mitte)));
      tueren.push(waagerecht ? { x: pos, y: fest, waagerecht: true, breite: TUERBREITE, aussen: false, von: k.a, nach: k.b } : { x: fest, y: pos, waagerecht: false, breite: TUERBREITE, aussen: false, von: k.a, nach: k.b });
    }
    // Haustür im Erdgeschoss an der Südwand des Eingangsraums.
    if (ei === 0) {
      const r = raeume[eingang]!.r;
      const suedlich = Math.abs(r.y + r.h - tiefe) < 1e-6;
      if (suedlich) tueren.push({ x: r.x + r.w / 2, y: tiefe, waagerecht: true, breite: 1.2, aussen: true, von: eingang, nach: -1 });
      else tueren.push({ x: gesamtBreite, y: r.y + r.h / 2, waagerecht: false, breite: 1.2, aussen: true, von: eingang, nach: -1 });
    }

    // Fenster an den Außenwänden, nicht auf Türen.
    const fenster: Fenster[] = [];
    const aussenwaende = (r: Raum): { waagerecht: boolean; fest: number; von: number; bis: number }[] => {
      const w: { waagerecht: boolean; fest: number; von: number; bis: number }[] = [];
      if (r.r.y < 1e-6) w.push({ waagerecht: true, fest: 0, von: r.r.x, bis: r.r.x + r.r.w });
      if (Math.abs(r.r.y + r.r.h - tiefe) < 1e-6) w.push({ waagerecht: true, fest: tiefe, von: r.r.x, bis: r.r.x + r.r.w });
      if (r.r.x < 1e-6) w.push({ waagerecht: false, fest: 0, von: r.r.y, bis: r.r.y + r.r.h });
      if (Math.abs(r.r.x + r.r.w - gesamtBreite) < 1e-6) w.push({ waagerecht: false, fest: gesamtBreite, von: r.r.y, bis: r.r.y + r.r.h });
      return w;
    };
    for (const r of raeume) {
      if (r.art === 'keller' || r.art === 'zelle') continue;
      for (const w of aussenwaende(r)) {
        const laenge = w.bis - w.von;
        const n = Math.floor(laenge / 3.4);
        for (let i = 0; i < Math.max(n, laenge >= 2.4 ? 1 : 0); i++) {
          const pos = w.von + (laenge * (i + 0.5)) / Math.max(n, 1);
          const stoert = tueren.some(t => t.aussen && t.waagerecht === w.waagerecht && Math.abs((w.waagerecht ? t.y : t.x) - w.fest) < 1e-6 && Math.abs((w.waagerecht ? t.x : t.y) - pos) < t.breite / 2 + 0.9);
          if (!stoert) fenster.push({ x: w.waagerecht ? pos : w.fest, y: w.waagerecht ? w.fest : pos, waagerecht: w.waagerecht, breite: 1.2 });
        }
      }
    }
    return { name: e.name ?? (g.etagen.length === 1 ? '' : ei === 0 ? 'Erdgeschoss' : `${ei}. Stock`), raeume, tueren, fenster };
  });
  // Nummern über alle Etagen fortlaufend (erst unten, dann oben).
  let nr = 1;
  for (const e of etagen) for (const r of e.raeume) r.nr = nr++;
  return { name: g.name, typ: g.typ ?? '', gelaende: g.gelaende ?? 'gras', breite: gesamtBreite, tiefe, etagen, seed };
}
