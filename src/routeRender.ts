import { HEIGHT, WIDTH, dist, type Point } from './geometry';
import { FARBE, SCHRIFT, defs, f, kompass, rahmen, titel, type Palette } from './render';
import type { Routenplan, WegArt } from './route';
import { KM_PRO_PIXEL } from './route';

export interface RoutenKarte {
  svg: string;
  breite: number;
  hoehe: number;
  marken: { nr: number; name: string; art: 'station'; x: number; y: number; kurz: string }[];
  km: number;
}

/** Das Bild der Weltkarte, das ausgeschnitten wird: eine URL oder ein data:-URI und seine Größe in Pixeln. */
export interface KartenBild {
  href: string;
  breite: number;
  hoehe: number;
}

/** Rahmen für den Kartenausschnitt innerhalb des Blatts. */
export const ROUTE_FLAECHE = { x: 50, y: 100, w: WIDTH - 100, h: HEIGHT - 180 };

const WEG_STIL: Record<WegArt, { dash: string; breite: number }> = {
  strasse: { dash: '', breite: 4 },
  pfad: { dash: '9 7', breite: 3.4 },
  schiff: { dash: '2 8', breite: 4.4 },
  pass: { dash: '16 5 3 5', breite: 3.6 },
};

const pfadD = (pts: Point[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join('');

export function rendereRoute(plan: Routenplan, bild: KartenBild): RoutenKarte {
  const F: Palette = { ...FARBE };
  const a = plan.ausschnitt;
  const s = ROUTE_FLAECHE.w / a.w;
  const px = (p: Point): Point => ({ x: ROUTE_FLAECHE.x + (p.x - a.x) * s, y: ROUTE_FLAECHE.y + (p.y - a.y) * s });
  const t: string[] = [];
  t.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="${F.pergament}"/><rect width="${WIDTH}" height="${HEIGHT}" filter="url(#papier)"/>`);

  // Kartenausschnitt, leicht ins Pergament getönt.
  const fl = ROUTE_FLAECHE;
  t.push(`<svg x="${fl.x}" y="${fl.y}" width="${fl.w}" height="${fl.h}" viewBox="${f(a.x)} ${f(a.y)} ${f(a.w)} ${f(a.h)}" preserveAspectRatio="none"><image href="${bild.href}" x="0" y="0" width="${bild.breite}" height="${bild.hoehe}" preserveAspectRatio="none"/></svg>`);
  t.push(`<rect x="${fl.x}" y="${fl.y}" width="${fl.w}" height="${fl.h}" fill="${F.pergament}" opacity=".28" style="mix-blend-mode:multiply"/>`);
  t.push(`<rect x="${fl.x}" y="${fl.y}" width="${fl.w}" height="${fl.h}" fill="none" stroke="${F.tinte}" stroke-width="2"/>`);

  // Verlauf: erst helle Unterlage, dann die Linie je Wegart.
  const st = plan.stationen.map(x => ({ ...x, q: px(x.p) }));
  const linie = plan.linie.map(px);
  // Teilstück je Strecke: der Linienpunkt, der der Station am nächsten liegt, trennt die Strecken.
  const grenzen = st.map(x => linie.reduce((b, p, i) => (dist(p, x.q) < dist(linie[b]!, x.q) ? i : b), 0));
  t.push(`<path d="${pfadD(linie)}" fill="none" stroke="${F.pergament}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/>`);
  for (let i = 1; i < st.length; i++) {
    const teil = linie.slice(grenzen[i - 1]!, grenzen[i]! + 1);
    if (teil.length < 2) continue;
    const stil = WEG_STIL[st[i]!.weg];
    t.push(`<path d="${pfadD(teil)}" fill="none" stroke="#7a1f14" stroke-width="${stil.breite}" stroke-linecap="round" stroke-linejoin="round"${stil.dash ? ` stroke-dasharray="${stil.dash}"` : ''}/>`);
    // Pfeil in der Mitte der Strecke zeigt die Richtung.
    const m = Math.floor(teil.length / 2);
    const p = teil[m]!;
    const q = teil[Math.min(m + 1, teil.length - 1)]!;
    const o = teil[Math.max(m - 1, 0)]!;
    const w = (Math.atan2(q.y - o.y, q.x - o.x) * 180) / Math.PI;
    t.push(`<path d="M-9 -7L9 0L-9 7Z" transform="translate(${f(p.x)} ${f(p.y)}) rotate(${f(w)})" fill="#7a1f14" stroke="${F.pergament}" stroke-width="1.6" stroke-linejoin="round"/>`);
  }

  // Stationen und Namen; Namen weichen Abzeichen und anderen Namen aus.
  const belegt: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const frei = (b: { x0: number; y0: number; x1: number; y1: number }) => b.x0 > fl.x + 6 && b.x1 < fl.x + fl.w - 6 && b.y0 > fl.y + 6 && b.y1 < fl.y + fl.h - 6 && !belegt.some(o => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0);
  for (const x of st) belegt.push({ x0: x.q.x - 16, y0: x.q.y - 16, x1: x.q.x + 16, y1: x.q.y + 16 });
  const marken: RoutenKarte['marken'] = [];
  for (const x of st) {
    if (x.punkt) {
      t.push(`<circle cx="${f(x.q.x)}" cy="${f(x.q.y)}" r="3.5" fill="#7a1f14" stroke="${F.pergament}" stroke-width="1.4"/>`);
      continue;
    }
    const tw = x.name.length * 9.2 + 10;
    const th = 22;
    const kandidaten = [
      { dx: 18, dy: -th / 2 }, { dx: -18 - tw, dy: -th / 2 }, { dx: -tw / 2, dy: -th - 18 }, { dx: -tw / 2, dy: 18 },
      { dx: 18, dy: -th - 10 }, { dx: 18, dy: 10 }, { dx: -18 - tw, dy: -th - 10 }, { dx: -18 - tw, dy: 10 },
    ].map(c => ({ ...c, b: { x0: x.q.x + c.dx, y0: x.q.y + c.dy, x1: x.q.x + c.dx + tw, y1: x.q.y + c.dy + th } }));
    const wahl = kandidaten.find(c => frei(c.b)) ?? kandidaten[0]!;
    belegt.push(wahl.b);
    t.push(`<rect x="${f(wahl.b.x0)}" y="${f(wahl.b.y0)}" width="${f(tw)}" height="${th}" rx="3" fill="${F.pergament}" fill-opacity=".86" stroke="${F.tinte}" stroke-width=".8"/>`);
    t.push(`<text x="${f(wahl.b.x0 + tw / 2)}" y="${f(wahl.b.y0 + 16)}" font-family="${SCHRIFT}" font-size="16" text-anchor="middle" fill="${F.text}">${x.name}</text>`);
    t.push(`<circle cx="${f(x.q.x)}" cy="${f(x.q.y)}" r="13" fill="${F.pergament}" stroke="${F.tinte}" stroke-width="2"/><text x="${f(x.q.x)}" y="${f(x.q.y + 5.5)}" font-family="${SCHRIFT}" font-size="15" font-weight="bold" text-anchor="middle" fill="${F.text}">${x.nr}</text>`);
    marken.push({ nr: x.nr, name: x.name, art: 'station', x: x.q.x, y: x.q.y, kurz: x.kurz });
  }

  // Maßstab in Kilometern und Streckenlänge.
  const kmProPx = KM_PRO_PIXEL / s;
  const feld = [10, 20, 25, 50, 100, 200, 250, 500].find(k => k / kmProPx >= 45) ?? 500;
  const seg = feld / kmProPx;
  const x0 = 58;
  const y0 = HEIGHT - 52;
  const balken = [0, 1, 2].map(i => `<rect x="${f(x0 + i * seg)}" y="${y0}" width="${f(seg)}" height="8" fill="${i % 2 ? F.pergament : F.tinte}" stroke="${F.tinte}" stroke-width="1"/>`).join('');
  const zahlen = ['0', String(feld), `${feld * 2} km`].map((z, i) => `<text x="${f(x0 + i * seg)}" y="${y0 - 6}" font-family="${SCHRIFT}" font-size="13" text-anchor="${i === 2 ? 'start' : 'middle'}" fill="${F.text}">${z}</text>`).join('');
  t.push(`<g><rect x="${x0 - 22}" y="${y0 - 26}" width="${f(3 * seg + 90)}" height="50" fill="${F.pergament}" fill-opacity=".9" stroke="${F.tinte}" stroke-width="1.2"/>${balken}${zahlen}</g>`);
  const km = Math.round(plan.km / 5) * 5;
  t.push(`<g><rect x="${WIDTH - 410}" y="${HEIGHT - 76}" width="220" height="34" fill="${F.pergament}" fill-opacity=".9" stroke="${F.tinte}" stroke-width="1.2"/><text x="${WIDTH - 300}" y="${HEIGHT - 53}" font-family="${SCHRIFT}" font-size="17" text-anchor="middle" fill="${F.text}">Strecke: etwa ${km} km</text></g>`);

  t.push(`<rect width="${WIDTH}" height="${HEIGHT}" filter="url(#koernung)" opacity=".5"/>`);
  t.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#vignette)"/>`);
  t.push(kompass(F), titel(plan.name, F), rahmen(F));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">${defs(F)}${t.join('')}</svg>`;
  return { svg, breite: WIDTH, hoehe: HEIGHT, marken, km: plan.km };
}
