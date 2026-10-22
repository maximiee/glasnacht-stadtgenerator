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
