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
  /** Mauerradius in Metern (grobe Stadtgröße). */
  radius?: number;
  wasser?: Wasser;
  mauer?: boolean;
  /** Feste Viertel mit Namen. Lage und Fläche bestimmt der Generator, sofern keine `lage` gesetzt ist. */
  viertel?: { name: string; lage?: 'nord' | 'ost' | 'sued' | 'west' | 'mitte' | 'aussen' }[];
  /** Orte (POI) aus den Glasnacht-Daten, werden später in ihr Viertel gesetzt. */
  orte?: { name: string; art?: string; viertel?: string }[];
}

const WASSER: Wasser[] = ['fluss', 'kueste', 'keins'];

export function liesStadt(json: string | unknown): StadtDatei {
  const roh = typeof json === 'string' ? JSON.parse(json) : json;
  if (typeof roh !== 'object' || roh === null) throw new Error('Stadt-JSON muss ein Objekt sein');
  const s = roh as Record<string, unknown>;
  if (s.version !== 1) throw new Error(`Unbekannte Version: ${String(s.version)} (erwartet 1)`);
  if (typeof s.name !== 'string' || !s.name) throw new Error('Feld "name" fehlt');
  if (s.wasser !== undefined && !WASSER.includes(s.wasser as Wasser)) throw new Error(`Feld "wasser" muss eines von ${WASSER.join(', ')} sein`);
  if (s.radius !== undefined && (typeof s.radius !== 'number' || s.radius < 100 || s.radius > 600)) throw new Error('Feld "radius" muss eine Zahl zwischen 100 und 600 sein');
  return roh as StadtDatei;
}

export function umrissOptionen(s: StadtDatei): UmrissOptionen {
  return { seed: s.seed ?? s.name, wasser: s.wasser, radius: s.radius, mauer: s.mauer };
}
