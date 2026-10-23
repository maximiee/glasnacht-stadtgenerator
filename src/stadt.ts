import type { UmrissOptionen, Wasser } from './outline';

/**
 * Eingabeformat des Generators: eine JSON-Datei pro Stadt, erzeugt von Glasnacht.
 * Alles außer `name` ist optional; fehlende Angaben füllt der Generator aus dem Seed.
 */
export interface StadtDatei {
  version: 1;
  name: string;
  /** Gleicher Seed ergibt dieselbe Stadt. Standard: der Name. */
  seed?: string | number;
  /** Einwohnerzahl, bestimmt die Größe der Stadt (z. B. 80000 oder 5000). */
  einwohner?: number;
  /** Mauerradius in Zeichnungseinheiten, überschreibt die Größe nach `einwohner`. */
  radius?: number;
  wasser?: Wasser;
  mauer?: boolean;
  /** Küste: Himmelsrichtung des Meeres (`west`, `nordost` ...). Fluss: Achse (`nord-sued`, `west-ost` ...). */
  lage?: string;
  /** Umgebung: bestimmt Farben von Boden, Häusern und Straßen. Standard `gras`. */
  gelaende?: Gelaende;
  tore?: number;
  /** Feste Viertel mit Namen. Lage und Fläche bestimmt der Generator, sofern keine `lage` gesetzt ist. */
  viertel?: { name: string; lage?: ViertelLage; kurz?: string }[];
  /** Orte (POI) aus den Glasnacht-Daten, werden später in ihr Viertel gesetzt. */
  orte?: { name: string; art?: string; viertel?: string; kurz?: string }[];
}

/** Lage eines Viertels in der Stadt; `wasser` = zur Küste bzw. zum Fluss hin (ohne Wasser: Rand). */
export type ViertelLage = 'nord' | 'nordost' | 'ost' | 'suedost' | 'sued' | 'suedwest' | 'west' | 'nordwest' | 'mitte' | 'aussen' | 'wasser';

export type Gelaende = 'gras' | 'wueste' | 'eis' | 'gebirge';
const GELAENDE: Gelaende[] = ['gras', 'wueste', 'eis', 'gebirge'];

const WASSER: Wasser[] = ['fluss', 'kueste', 'keins'];

const REF_EINWOHNER = 80000;
const REF_RADIUS_M = 900;

/** Mauerradius in Zeichnungseinheiten: wächst mit der Wurzel der Einwohnerzahl (Fläche ~ Einwohner), 5.000 → ca. 210, 80.000 → 400. */
export function radiusFuer(s: Pick<StadtDatei, 'einwohner' | 'radius'>): number {
  if (s.einwohner !== undefined && (typeof s.einwohner !== 'number' || s.einwohner < 500 || s.einwohner > 200000)) throw new Error('Feld "einwohner" muss eine Zahl zwischen 500 und 200000 sein');
  if (s.radius !== undefined) return s.radius;
  if (s.einwohner === undefined) return 330;
  return 150 + 250 * Math.sqrt(Math.min(s.einwohner, REF_EINWOHNER) / REF_EINWOHNER);
}

/** Meter je Zeichnungseinheit: Der echte Mauerradius wächst ebenfalls mit der Wurzel der Einwohnerzahl (80.000 → 900 m). */
export function meterProEinheit(s: Pick<StadtDatei, 'einwohner' | 'radius'>): number {
  if (s.einwohner === undefined) return 2;
  return (REF_RADIUS_M * Math.sqrt(Math.min(s.einwohner, REF_EINWOHNER) / REF_EINWOHNER)) / radiusFuer(s);
}

export function liesStadt(json: string | unknown): StadtDatei {
  const roh = typeof json === 'string' ? JSON.parse(json) : json;
  if (typeof roh !== 'object' || roh === null) throw new Error('Stadt-JSON muss ein Objekt sein');
  const s = roh as Record<string, unknown>;
  if (s.version !== 1) throw new Error(`Unbekannte Version: ${String(s.version)} (erwartet 1)`);
  if (typeof s.name !== 'string' || !s.name) throw new Error('Feld "name" fehlt');
  if (s.wasser !== undefined && !WASSER.includes(s.wasser as Wasser)) throw new Error(`Feld "wasser" muss eines von ${WASSER.join(', ')} sein`);
  if (s.gelaende !== undefined && !GELAENDE.includes(s.gelaende as Gelaende)) throw new Error(`Feld "gelaende" muss eines von ${GELAENDE.join(', ')} sein`);
  if (s.radius !== undefined && (typeof s.radius !== 'number' || s.radius < 100 || s.radius > 600)) throw new Error('Feld "radius" muss eine Zahl zwischen 100 und 600 sein');
  return roh as StadtDatei;
}

export function umrissOptionen(s: StadtDatei): UmrissOptionen {
  return { seed: s.seed ?? s.name, wasser: s.wasser, radius: radiusFuer(s), mauer: s.mauer, lage: s.lage, tore: s.tore };
}
