import { erzeugeUmriss, type UmrissOptionen } from './outline';
import { rendereSvg } from './render';
import { liesStadt, umrissOptionen, type StadtDatei } from './stadt';

export { erzeugeUmriss, rendereSvg, liesStadt, umrissOptionen };
export type { UmrissOptionen, StadtDatei };

export const stadtAlsSvg = (opt: UmrissOptionen, name?: string) => rendereSvg(erzeugeUmriss(opt), name);

/** Stadt-JSON (Text oder Objekt) laden und als SVG zeichnen. */
export function stadtDateiAlsSvg(json: string | unknown): string {
  const s = liesStadt(json);
  return stadtAlsSvg(umrissOptionen(s), s.name);
}
