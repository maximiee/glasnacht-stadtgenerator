import { erzeugeUmriss, type UmrissOptionen } from './outline';
import { erzeugeStadtplan } from './stadtplan';
import { rendereSvg } from './render';
import { liesStadt, umrissOptionen, type StadtDatei } from './stadt';
import { legeBeschriftung } from './beschriftung';
import { WIDTH, HEIGHT } from './geometry';
import { erzeugeGebaeude, liesGebaeude } from './gebaeude';
import { rendereGebaeude, type GebaeudeKarte } from './gebaeudeRender';
import { erzeugeHoehle, liesHoehle } from './hoehle';
import { rendereHoehle, type HoehleKarte } from './hoehleRender';
import { erzeugeRoute, liesRoute, type OrtListe } from './route';
import { rendereRoute, ROUTE_FLAECHE, type KartenBild, type RoutenKarte } from './routeRender';

export { erzeugeUmriss, erzeugeStadtplan, rendereSvg, liesStadt, umrissOptionen };
export type { UmrissOptionen, StadtDatei };

export const stadtAlsSvg = (opt: UmrissOptionen, name = 'Stadt') => rendereSvg(erzeugeStadtplan({ version: 1, name, ...opt }), name);

/** Stadt-JSON (Text oder Objekt) laden und als SVG zeichnen. */
export function stadtDateiAlsSvg(json: string | unknown): string {
  const s = liesStadt(json);
  return rendereSvg(erzeugeStadtplan(s), s.name);
}

/** Nummerierte Stelle auf dem Plan: Viertel oder Ort, mit Pixelposition der Marke im Bild. */
export interface Marke {
  nr: number;
  name: string;
  art: 'viertel' | 'ort';
  x: number;
  y: number;
  kurz: string;
}

export interface StadtKarte {
  svg: string;
  breite: number;
  hoehe: number;
  marken: Marke[];
}

/** Wie `stadtDateiAlsSvg`, dazu die nummerierten Marken (Viertel zuerst, dann Orte) mit ihren `kurz`-Texten. */
export function stadtDateiAlsKarte(json: string | unknown): StadtKarte {
  const s = liesStadt(json);
  const plan = erzeugeStadtplan(s);
  const kurz = new Map<string, string>([...(s.viertel ?? []), ...(s.orte ?? [])].map(e => [e.name, e.kurz ?? '']));
  const marken = legeBeschriftung(plan).map(l => ({
    nr: l.nr,
    name: l.name,
    art: l.art,
    x: Math.round(l.marke.x),
    y: Math.round(l.marke.y),
    kurz: kurz.get(l.name) ?? '',
  }));
  return { svg: rendereSvg(plan, s.name), breite: WIDTH, hoehe: HEIGHT, marken };
}

export { liesGebaeude, erzeugeGebaeude, RAUM_ARTEN, GEBAEUDE_MAX_ETAGEN, GEBAEUDE_MAX_RAEUME } from './gebaeude';
export type { GebaeudeDatei, RaumArt, RaumEingabe, EtageEingabe, Gebaeudeplan } from './gebaeude';
export { rendereGebaeude, type GebaeudeKarte } from './gebaeudeRender';

/** Gebäude-JSON laden, Grundriss erzeugen und zeichnen; dazu die nummerierten Räume mit Kurztext. */
export function gebaeudeDateiAlsKarte(json: string | unknown): GebaeudeKarte {
  return rendereGebaeude(erzeugeGebaeude(liesGebaeude(json)));
}

/** Ob ein JSON ein Gebäude (mit `raeume` oder `etagen`) statt einer Stadt beschreibt. */
export function istGebaeude(json: unknown): boolean {
  return typeof json === 'object' && json !== null && ('raeume' in json || 'etagen' in json);
}

export { liesHoehle, erzeugeHoehle, KAMMER_ARTEN, HOEHLE_MAX_KAMMERN } from './hoehle';
export type { HoehleDatei, KammerArt, KammerEingabe, Hoehlenplan } from './hoehle';
export { rendereHoehle, type HoehleKarte } from './hoehleRender';

/** Höhlen-JSON laden, Plan erzeugen und zeichnen; dazu die nummerierten Kammern mit Kurztext. */
export function hoehleDateiAlsKarte(json: string | unknown): HoehleKarte {
  return rendereHoehle(erzeugeHoehle(liesHoehle(json)));
}

/** Ob ein JSON eine Höhle (mit `kammern`) beschreibt. */
export function istHoehle(json: unknown): boolean {
  return typeof json === 'object' && json !== null && 'kammern' in json;
}

export { liesRoute, erzeugeRoute, WEG_ARTEN, ROUTE_MAX_STATIONEN, KM_PRO_PIXEL } from './route';
export type { RouteDatei, StationEingabe, Routenplan, OrtListe, WegArt } from './route';
export { rendereRoute, type RoutenKarte, type KartenBild } from './routeRender';

/** Routen-JSON laden und als Ausschnitt der Weltkarte zeichnen; `orte` löst Ortsnamen in Pixel auf, `bild` ist die Weltkarte. */
export function routeDateiAlsKarte(json: string | unknown, orte: OrtListe, bild: KartenBild): RoutenKarte {
  return rendereRoute(erzeugeRoute(liesRoute(json), orte, bild, ROUTE_FLAECHE.w / ROUTE_FLAECHE.h), bild);
}

/** Ob ein JSON eine Reiseroute (mit `stationen`) beschreibt. */
export function istRoute(json: unknown): boolean {
  return typeof json === 'object' && json !== null && 'stationen' in json;
}
