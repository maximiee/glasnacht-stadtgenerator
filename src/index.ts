import { erzeugeUmriss, type UmrissOptionen } from './outline';
import { erzeugeStadtplan } from './stadtplan';
import { rendereSvg } from './render';
import { liesStadt, umrissOptionen, type StadtDatei } from './stadt';

export { erzeugeUmriss, erzeugeStadtplan, rendereSvg, liesStadt, umrissOptionen };
export type { UmrissOptionen, StadtDatei };

export const stadtAlsSvg = (opt: UmrissOptionen, name = 'Stadt') => rendereSvg(erzeugeStadtplan({ version: 1, name, ...opt }), name);

/** Stadt-JSON (Text oder Objekt) laden und als SVG zeichnen. */
export function stadtDateiAlsSvg(json: string | unknown): string {
  const s = liesStadt(json);
  return rendereSvg(erzeugeStadtplan(s), s.name);
}
