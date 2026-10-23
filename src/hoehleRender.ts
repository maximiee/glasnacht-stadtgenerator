import { createRng } from './rng';
import { HEIGHT, WIDTH, distZuLinie, inPolygon, type Point } from './geometry';
import { FARBE, PALETTE, SCHRIFT, defs, f, kompass, massstab, rahmen, titel, type Palette } from './render';
import type { Hoehlenplan, Kammer } from './hoehle';

/** Geschlossene weiche Kurve durch die Punkte (Catmull-Rom als Bézier). */
function geschlossenerPfad(pts: Point[], px: (p: Point) => Point): string {
  const n = pts.length;
  const q = pts.map(px);
  let d = `M${f(q[0]!.x)} ${f(q[0]!.y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = q[(i - 1 + n) % n]!;
    const p1 = q[i]!;
    const p2 = q[(i + 1) % n]!;
    const p3 = q[(i + 2) % n]!;
    d += `C${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)} ${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d + 'Z';
}

const offenerPfad = (pts: Point[], px: (p: Point) => Point) => pts.map((p, i) => `${i ? 'L' : 'M'}${f(px(p).x)} ${f(px(p).y)}`).join('');

const FELS_BODEN = '#e4d2a4';

export interface HoehleKarte {
  svg: string;
  breite: number;
  hoehe: number;
  marken: { nr: number; name: string; art: 'kammer'; x: number; y: number; kurz: string }[];
}

export function rendereHoehle(plan: Hoehlenplan): HoehleKarte {
  const F: Palette = { ...FARBE, ...PALETTE[plan.gelaende] };
  const alle: Point[] = [...plan.kammern.flatMap(k => k.umriss), ...plan.zugang];
  const x0 = Math.min(...alle.map(p => p.x));
  const x1 = Math.max(...alle.map(p => p.x));
  const y0 = Math.min(...alle.map(p => p.y));
  const y1 = Math.max(...alle.map(p => p.y));
  const rand = 6; // Meter Fels um die Höhle
  const bw = x1 - x0 + 2 * rand;
  const bh = y1 - y0 + 2 * rand;
  const fl = { x: 80, y: 120, w: WIDTH - 160, h: HEIGHT - 250 };
  const s = Math.min(38, fl.w / bw, fl.h / bh);
  const ox = fl.x + (fl.w - bw * s) / 2 - (x0 - rand) * s;
  const oy = fl.y + (fl.h - bh * s) / 2 - (y0 - rand) * s;
  const px = (p: Point): Point => ({ x: ox + p.x * s, y: oy + p.y * s });
  const rng = createRng(`${plan.seed}#deko`);
  const t: string[] = [];
  t.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="${F.pergament}"/><rect width="${WIDTH}" height="${HEIGHT}" filter="url(#papier)"/>`);

  // Fels: Schraffur um die Höhle, nach außen dünner.
  const hatch: string[] = [];
  const innen = (p: Point) => plan.kammern.some(k => inPolygon(p, k.umriss)) || plan.gaenge.some(g => distZuLinie(p, g.linie, false) < g.breite / 2) || distZuLinie(p, plan.zugang, false) < 1.3;
  const abstand = (p: Point) => Math.min(
    ...plan.kammern.map(k => distZuLinie(p, k.umriss, true)),
    ...plan.gaenge.map(g => distZuLinie(p, g.linie, false) - g.breite / 2),
    distZuLinie(p, plan.zugang, false) - 1.3,
  );
  const schritt = 1.25;
  for (let y = y0 - rand; y <= y1 + rand; y += schritt) {
    for (let x = x0 - rand; x <= x1 + rand; x += schritt) {
      const p = { x: x + (rng() - 0.5) * schritt, y: y + (rng() - 0.5) * schritt };
      if (innen(p)) continue;
      const d = abstand(p);
      if (d < 0.7 || d > 5.2) continue;
      if (rng() > 1.25 - d / 5.2 * 1.1) continue;
      const w = Math.PI * 0.27 + (rng() - 0.5) * 0.7;
      const l = (0.9 + rng() * 1.1) * (1.15 - d / 9);
      const a = px({ x: p.x - Math.cos(w) * l / 2, y: p.y - Math.sin(w) * l / 2 });
      const b = px({ x: p.x + Math.cos(w) * l / 2, y: p.y + Math.sin(w) * l / 2 });
      hatch.push(`M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`);
    }
  }
  t.push(`<path d="${hatch.join('')}" stroke="${F.tinte}" stroke-opacity=".5" stroke-width="1" stroke-linecap="round" fill="none"/>`);

  // Wände: erst alles in Tinte, etwas dicker, dann der Boden darüber.
  const wand = Math.max(3, 0.55 * s);
  const wandSvg: string[] = [];
  const bodenSvg: string[] = [];
  for (const k of plan.kammern) {
    const d = geschlossenerPfad(k.umriss, px);
    wandSvg.push(`<path d="${d}" fill="${F.tinte}" stroke="${F.tinte}" stroke-width="${f(2 * wand)}" stroke-linejoin="round"/>`);
    bodenSvg.push(`<path d="${d}" fill="${FELS_BODEN}"/>`);
  }
  const gaenge = [...plan.gaenge.map(g => ({ linie: g.linie, breite: g.breite })), { linie: plan.zugang, breite: 2.6 }];
  for (const g of gaenge) {
    const d = offenerPfad(g.linie, px);
    wandSvg.push(`<path d="${d}" fill="none" stroke="${F.tinte}" stroke-width="${f(g.breite * s + 2 * wand)}" stroke-linecap="round" stroke-linejoin="round"/>`);
    bodenSvg.push(`<path d="${d}" fill="none" stroke="${FELS_BODEN}" stroke-width="${f(g.breite * s)}" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  t.push(`<g>${wandSvg.join('')}</g><g>${bodenSvg.join('')}</g>`);

  // Ausstattung der Kammern.
  const innenPunkt = (k: Kammer, rand2: number): Point | null => {
    for (let i = 0; i < 30; i++) {
      const w = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * k.radius * 0.9;
      const p = { x: k.mitte.x + Math.cos(w) * r, y: k.mitte.y + Math.sin(w) * r };
      if (inPolygon(p, k.umriss) && distZuLinie(p, k.umriss, true) > rand2) return p;
    }
    return null;
  };
  const ink = `stroke="${F.tinte}" stroke-width="1.1"`;
  for (const k of plan.kammern) {
    const mitte = px(k.mitte);
    if (k.art === 'see' || k.art === 'quelle') {
      const klein = k.umriss.map(p => ({ x: k.mitte.x + (p.x - k.mitte.x) * (k.art === 'see' ? 0.72 : 0.4), y: k.mitte.y + (p.y - k.mitte.y) * (k.art === 'see' ? 0.72 : 0.4) }));
      t.push(`<path d="${geschlossenerPfad(klein, px)}" fill="${F.wasser}" stroke="${F.wasserRand}" stroke-width="1.6"/>`);
      for (let i = 0; i < 4; i++) {
        const q = px({ x: k.mitte.x + (rng() - 0.5) * k.radius * 0.9, y: k.mitte.y + (rng() - 0.5) * k.radius * 0.9 });
        t.push(`<path d="M${f(q.x - 9)} ${f(q.y)}q4.5 -4 9 0t9 0" fill="none" stroke="${F.wasserRand}" stroke-width=".9" stroke-opacity=".7"/>`);
      }
    } else if (k.art === 'schacht') {
      for (const m of [1, 0.66, 0.34]) t.push(`<circle cx="${f(mitte.x)}" cy="${f(mitte.y)}" r="${f(k.radius * 0.62 * m * s)}" fill="${m === 0.34 ? '#2c2218' : m === 0.66 ? '#6b5a44' : '#9b8761'}" ${ink}/>`);
    } else if (k.art === 'schatz') {
      for (let i = 0; i < 5; i++) { const p = innenPunkt(k, 1.0); if (p) { const q = px(p); t.push(`<circle cx="${f(q.x)}" cy="${f(q.y)}" r="${f(0.22 * s)}" fill="#d9b24a" ${ink}/>`); } }
      const p = innenPunkt(k, 1.6);
      if (p) { const q = px(p); t.push(`<rect x="${f(q.x - 0.5 * s)}" y="${f(q.y - 0.3 * s)}" width="${f(s)}" height="${f(0.6 * s)}" fill="${F.holz}" ${ink}/><path d="M${f(q.x - 0.5 * s)} ${f(q.y)}H${f(q.x + 0.5 * s)}" stroke="${F.tinte}" stroke-width=".8"/>`); }
    } else if (k.art === 'lager') {
      for (let i = 0; i < 3; i++) { const p = innenPunkt(k, 1.2); if (p) { const q = px(p); t.push(`<rect x="${f(q.x - 0.45 * s)}" y="${f(q.y - 0.9 * s)}" width="${f(0.9 * s)}" height="${f(1.8 * s)}" rx="${f(0.3 * s)}" fill="#efe3c3" ${ink} transform="rotate(${f(rng() * 360)} ${f(q.x)} ${f(q.y)})"/>`); } }
      t.push(`<circle cx="${f(mitte.x)}" cy="${f(mitte.y)}" r="${f(0.5 * s)}" fill="#c98a45" ${ink}/><circle cx="${f(mitte.x)}" cy="${f(mitte.y)}" r="${f(0.22 * s)}" fill="#e8b14d"/>`);
    } else if (k.art === 'brut') {
      for (let i = 0; i < 6; i++) { const p = innenPunkt(k, 1.0); if (p) { const q = px(p); t.push(`<ellipse cx="${f(q.x)}" cy="${f(q.y)}" rx="${f(0.32 * s)}" ry="${f(0.45 * s)}" fill="#efe6c8" ${ink} transform="rotate(${f(rng() * 90 - 45)} ${f(q.x)} ${f(q.y)})"/>`); } }
    } else if (k.art === 'halle') {
      for (let i = 0; i < 4; i++) { const p = innenPunkt(k, 1.6); if (p) { const q = px(p); t.push(`<circle cx="${f(q.x)}" cy="${f(q.y)}" r="${f((0.55 + rng() * 0.3) * s)}" fill="#c8bba2" ${ink}/>`); } }
    }
    // Tropfsteine (Stalagmiten) in allen Kammern, wenige in Seen.
    const anzahl = Math.round((k.radius * k.radius * Math.PI) / (k.art === 'see' ? 90 : 38));
    for (let i = 0; i < anzahl; i++) {
      const p = innenPunkt(k, 0.9);
      if (!p) continue;
      const q = px(p);
      const r = (0.18 + rng() * 0.3) * s;
      t.push(`<circle cx="${f(q.x)}" cy="${f(q.y)}" r="${f(r)}" fill="#bfae8a" ${ink}/><circle cx="${f(q.x - r * 0.25)}" cy="${f(q.y - r * 0.25)}" r="${f(r * 0.4)}" fill="#e2d6b8"/>`);
    }
  }

  // Zugang: Pfeil nach außen.
  const e0 = plan.zugang[plan.zugang.length - 2]!;
  const e1 = plan.zugang[plan.zugang.length - 1]!;
  const a = Math.atan2(e1.y - e0.y, e1.x - e0.x);
  const sp = px(e1);
  t.push(`<path d="M${f(sp.x + Math.cos(a) * 12)} ${f(sp.y + Math.sin(a) * 12)}L${f(sp.x + Math.cos(a + 2.4) * 14)} ${f(sp.y + Math.sin(a + 2.4) * 14)}L${f(sp.x + Math.cos(a - 2.4) * 14)} ${f(sp.y + Math.sin(a - 2.4) * 14)}Z" fill="${F.tinte}"/>`);
  t.push(`<text x="${f(sp.x + Math.cos(a) * 30)}" y="${f(sp.y + Math.sin(a) * 30 + 4)}" text-anchor="middle" font-family="${SCHRIFT}" font-size="14" font-style="italic" fill="${F.text}" stroke="${F.pergament}" stroke-width="3" paint-order="stroke">Zugang</text>`);

  // Nummern und Namen
  const marken: HoehleKarte['marken'] = [];
  for (const k of plan.kammern) {
    const m = px(k.mitte);
    t.push(`<circle cx="${f(m.x)}" cy="${f(m.y)}" r="10" fill="${F.tinte}" stroke="${F.pergament}" stroke-width="1.5"/><text x="${f(m.x)}" y="${f(m.y + 4)}" text-anchor="middle" font-family="${SCHRIFT}" font-size="12" font-weight="700" fill="${F.pergament}">${k.nr}</text>`);
    marken.push({ nr: k.nr, name: k.name, art: 'kammer', x: Math.round(m.x), y: Math.round(m.y), kurz: k.kurz });
    if (k.radius * s * 1.5 >= k.name.length * 6.2)
      t.push(`<text x="${f(m.x)}" y="${f(m.y + 26)}" text-anchor="middle" font-family="${SCHRIFT}" font-size="13" font-style="italic" fill="${F.text}" stroke="${FELS_BODEN}" stroke-width="3" paint-order="stroke">${k.name}</text>`);
  }
  t.push(`<rect width="${WIDTH}" height="${HEIGHT}" filter="url(#koernung)" opacity=".5"/>`);
  t.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#vignette)"/>`);
  t.push(rahmen(F), titel(plan.name, F), massstab(F, 1 / s, [1, 2, 5, 10, 20, 50]), kompass(F));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">${defs(F)}${t.join('')}</svg>`;
  return { svg, breite: WIDTH, hoehe: HEIGHT, marken };
}
