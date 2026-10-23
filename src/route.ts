import { dist, smoothLine, type Point } from './geometry';

export const WEG_ARTEN = ['strasse', 'pfad', 'schiff', 'pass'] as const;
export type WegArt = (typeof WEG_ARTEN)[number];

export interface StationEingabe {
  name: string;
  /** Ortsname aus der Ortsliste der Weltkarte; ersetzt x und y. */
  ort?: string;
  /** Pixelkoordinaten auf der Weltkarte. */
  x?: number;
  y?: number;
  /** Wie man von der vorigen Station hierher kommt; ohne Angabe wie bei der vorigen Strecke. */
  weg?: WegArt;
  /** Nur Zwischenpunkt für den Verlauf: wird nicht nummeriert und nicht beschriftet. */
  punkt?: boolean;
  kurz?: string;
}

export interface RouteDatei {
  version: 1;
  name: string;
  stationen: StationEingabe[];
}

export const ROUTE_MAX_STATIONEN = 24;

/** Bekannte Orte der Weltkarte (Name → Pixel), z. B. aus `Karten/06_orte.json`. */
export type OrtListe = Record<string, { x: number; y: number }>;

export function liesRoute(json: string | unknown): RouteDatei {
  const roh = typeof json === 'string' ? JSON.parse(json) : json;
  if (typeof roh !== 'object' || roh === null) throw new Error('Routen-JSON muss ein Objekt sein');
  const r = roh as Record<string, unknown>;
  if (r.version !== 1) throw new Error(`Unbekannte Version: ${String(r.version)} (erwartet 1)`);
  if (typeof r.name !== 'string' || !r.name) throw new Error('Feld "name" fehlt');
  if (!Array.isArray(r.stationen) || r.stationen.length < 2) throw new Error('Feld "stationen" braucht mindestens zwei Einträge');
  if (r.stationen.length > ROUTE_MAX_STATIONEN) throw new Error(`Höchstens ${ROUTE_MAX_STATIONEN} Stationen`);
  const stationen = r.stationen.map((s: unknown, i: number): StationEingabe => {
    const x = s as Record<string, unknown>;
    if (typeof x?.name !== 'string' || !x.name) throw new Error(`Station ${i + 1}: "name" fehlt`);
    const hatOrt = typeof x.ort === 'string' && x.ort !== '';
    const hatXY = typeof x.x === 'number' && typeof x.y === 'number';
    if (!hatOrt && !hatXY) throw new Error(`Station „${x.name}“: "ort" oder "x" und "y" fehlen`);
    if (x.weg !== undefined && !WEG_ARTEN.includes(x.weg as WegArt)) throw new Error(`Station „${x.name}“: "weg" muss eines von ${WEG_ARTEN.join(', ')} sein`);
    return { name: x.name, ort: hatOrt ? (x.ort as string) : undefined, x: x.x as number | undefined, y: x.y as number | undefined, weg: x.weg as WegArt | undefined, punkt: x.punkt === true, kurz: typeof x.kurz === 'string' ? x.kurz : undefined };
  });
  if (stationen[0]!.punkt || stationen[stationen.length - 1]!.punkt) throw new Error('Erste und letzte Station dürfen kein Zwischenpunkt sein');
  return { version: 1, name: r.name, stationen };
}

export interface Station {
  /** 0 für Zwischenpunkte. */
  nr: number;
  name: string;
  kurz: string;
  /** Pixel auf der Weltkarte. */
  p: Point;
  weg: WegArt;
  punkt: boolean;
}

export interface Routenplan {
  name: string;
  stationen: Station[];
  /** Geglätteter Verlauf in Weltkarten-Pixeln. */
  linie: Point[];
  /** Ausschnitt der Weltkarte in Pixeln. */
  ausschnitt: { x: number; y: number; w: number; h: number };
  /** Länge des Verlaufs in Kilometern. */
  km: number;
}

export const KM_PRO_PIXEL = 2;

/** Verlauf und Kartenausschnitt bestimmen; Orte werden über `orte` aufgelöst. */
export function erzeugeRoute(r: RouteDatei, orte: OrtListe, karte: { breite: number; hoehe: number }, seitenverhaeltnis: number): Routenplan {
  let nr = 0;
  let weg: WegArt = 'strasse';
  const stationen = r.stationen.map((s): Station => {
    let p: Point;
    if (s.ort !== undefined) {
      const o = orte[s.ort];
      if (!o) throw new Error(`Station „${s.name}“: Ort „${s.ort}“ ist nicht auf der Karte`);
      p = { x: o.x, y: o.y };
    } else p = { x: s.x!, y: s.y! };
    if (p.x < 0 || p.y < 0 || p.x > karte.breite || p.y > karte.hoehe) throw new Error(`Station „${s.name}“: liegt außerhalb der Karte`);
    if (s.weg) weg = s.weg;
    return { nr: s.punkt ? 0 : ++nr, name: s.name, kurz: s.kurz ?? '', p, weg, punkt: !!s.punkt };
  });
  for (const [i, s] of stationen.entries()) if (i && dist(s.p, stationen[i - 1]!.p) < 1) throw new Error(`Stationen „${stationen[i - 1]!.name}“ und „${s.name}“ liegen an derselben Stelle`);
  const linie = smoothLine(stationen.map(s => s.p), 2);
  let laenge = 0;
  for (let i = 1; i < linie.length; i++) laenge += dist(linie[i - 1]!, linie[i]!);

  const xs = linie.map(p => p.x);
  const ys = linie.map(p => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  // Rand um die Route, Mindestgröße gegen zu starke Vergrößerung, Seitenverhältnis des Blatts.
  let w = Math.max((x1 - x0) * 1.3, 320);
  let h = Math.max((y1 - y0) * 1.3, 320 / seitenverhaeltnis);
  if (w / h < seitenverhaeltnis) w = h * seitenverhaeltnis; else h = w / seitenverhaeltnis;
  if (w > karte.breite) { w = karte.breite; h = w / seitenverhaeltnis; }
  if (h > karte.hoehe) { h = karte.hoehe; w = h * seitenverhaeltnis; }
  const x = Math.min(Math.max((x0 + x1) / 2 - w / 2, 0), karte.breite - w);
  const y = Math.min(Math.max((y0 + y1) / 2 - h / 2, 0), karte.hoehe - h);
  return { name: r.name, stationen, linie, ausschnitt: { x, y, w, h }, km: laenge * KM_PRO_PIXEL };
}
