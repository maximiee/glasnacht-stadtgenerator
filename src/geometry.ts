export interface Point {
  x: number;
  y: number;
}

export const WIDTH = 1400;
export const HEIGHT = 1280;

export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Glättet eine Linie mit Chaikin-Unterteilung (offen). */
export function smoothLine(pts: Point[], rounds = 2): Point[] {
  let cur = pts;
  for (let r = 0; r < rounds; r++) {
    const next: Point[] = [cur[0]!];
    for (let i = 0; i < cur.length - 1; i++) {
      const a = cur[i]!;
      const b = cur[i + 1]!;
      next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y });
      next.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    next.push(cur[cur.length - 1]!);
    cur = next;
  }
  return cur;
}

/** Verschiebt eine Linie seitlich um d (positiv = links der Laufrichtung). */
export function offsetLine(pts: Point[], d: number): Point[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: p.x - ((b.y - a.y) / len) * d, y: p.y + ((b.x - a.x) / len) * d };
  });
}

/** Punkt-in-Polygon (Strahlverfahren). */
export function inPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Schneidet die Strecke a-b mit einem (auch konkaven) Polygon, liefert die Teilstrecken innen. */
export function streckeInPolygon(a: Point, b: Point, poly: Point[]): [Point, Point][] {
  const ts = [0, 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const c = poly[j]!;
    const d = poly[i]!;
    const ex = d.x - c.x;
    const ey = d.y - c.y;
    const nenner = dx * ey - dy * ex;
    if (Math.abs(nenner) < 1e-9) continue;
    const t = ((c.x - a.x) * ey - (c.y - a.y) * ex) / nenner;
    const u = ((c.x - a.x) * dy - (c.y - a.y) * dx) / nenner;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
  }
  ts.sort((x, y) => x - y);
  const out: [Point, Point][] = [];
  for (let k = 0; k < ts.length - 1; k++) {
    const t0 = ts[k]!;
    const t1 = ts[k + 1]!;
    if (t1 - t0 < 1e-6) continue;
    const m = { x: a.x + dx * ((t0 + t1) / 2), y: a.y + dy * ((t0 + t1) / 2) };
    if (inPolygon(m, poly)) out.push([{ x: a.x + dx * t0, y: a.y + dy * t0 }, { x: a.x + dx * t1, y: a.y + dy * t1 }]);
  }
  return out;
}

export function distZuStrecke(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distZuLinie(p: Point, linie: Point[], geschlossen = false): number {
  let d = Infinity;
  const n = geschlossen ? linie.length : linie.length - 1;
  for (let i = 0; i < n; i++) d = Math.min(d, distZuStrecke(p, linie[i]!, linie[(i + 1) % linie.length]!));
  return d;
}
