import { createRng, type Rng } from './rng';
import { HEIGHT, WIDTH } from './geometry';
import { FARBE, PALETTE, RAND, SCHRIFT, defs, f, kompass, massstab, rahmen, titel, type Palette } from './render';
import { TREPPEN_LAENGE, type Etage, type Gebaeudeplan, type Raum, type Rechteck, type RaumArt } from './gebaeude';

type Moebel = { art: string; x: number; y: number; w: number; h: number; rund?: boolean };

const schneidet = (a: Rechteck, b: Rechteck, rand = 0) => a.x < b.x + b.w + rand && a.x + a.w + rand > b.x && a.y < b.y + b.h + rand && a.y + a.h + rand > b.y;

/** Was ein Raum an Möbeln bekommt: Art, Anzahl nach Fläche, Größe in Metern, an der Wand oder frei. */
const AUSSTATTUNG: Record<RaumArt, { art: string; n: (fl: number) => number; w: number; h: number; wand: boolean; rund?: boolean }[]> = {
  wohnraum: [{ art: 'tisch', n: fl => (fl > 18 ? 2 : 1), w: 1.4, h: 0.9, wand: false }, { art: 'kamin', n: () => 1, w: 1.4, h: 0.5, wand: true }, { art: 'regal', n: fl => Math.ceil(fl / 12), w: 0.4, h: 1.4, wand: true }, { art: 'truhe', n: () => 1, w: 0.9, h: 0.5, wand: true }],
  schlafraum: [{ art: 'bett', n: fl => Math.max(1, Math.floor(fl / 8)), w: 1.0, h: 2.0, wand: true }, { art: 'truhe', n: () => 1, w: 0.9, h: 0.5, wand: true }, { art: 'regal', n: () => 1, w: 0.4, h: 1.2, wand: true }],
  kueche: [{ art: 'herd', n: () => 1, w: 1.0, h: 0.7, wand: true }, { art: 'tisch', n: () => 1, w: 1.6, h: 0.9, wand: false }, { art: 'regal', n: fl => Math.ceil(fl / 8), w: 0.4, h: 1.4, wand: true }, { art: 'zuber', n: () => 1, w: 0.9, h: 0.9, wand: true, rund: true }],
  vorrat: [{ art: 'regal', n: fl => Math.ceil(fl / 3), w: 0.4, h: 1.5, wand: true }, { art: 'fass', n: fl => Math.ceil(fl / 4), w: 0.7, h: 0.7, wand: true, rund: true }, { art: 'truhe', n: () => 1, w: 0.9, h: 0.5, wand: true }],
  werkstatt: [{ art: 'werkbank', n: fl => Math.ceil(fl / 10), w: 0.8, h: 2.2, wand: true }, { art: 'esse', n: () => 1, w: 1.2, h: 1.2, wand: true }, { art: 'regal', n: () => 2, w: 0.4, h: 1.6, wand: true }, { art: 'fass', n: () => 1, w: 0.7, h: 0.7, wand: true, rund: true }],
  schankraum: [{ art: 'theke', n: () => 1, w: 0.7, h: 4.0, wand: true }, { art: 'tisch', n: fl => Math.ceil(fl / 7), w: 1.1, h: 1.1, wand: false, rund: true }, { art: 'fass', n: () => 3, w: 0.8, h: 0.8, wand: true, rund: true }, { art: 'kamin', n: () => 1, w: 1.6, h: 0.5, wand: true }],
  laden: [{ art: 'theke', n: () => 1, w: 0.7, h: 3.0, wand: false }, { art: 'regal', n: fl => Math.ceil(fl / 4), w: 0.4, h: 1.6, wand: true }, { art: 'truhe', n: () => 2, w: 0.9, h: 0.5, wand: true }],
  lager: [{ art: 'kiste', n: fl => Math.ceil(fl / 3), w: 0.8, h: 0.8, wand: true }, { art: 'fass', n: fl => Math.ceil(fl / 5), w: 0.7, h: 0.7, wand: true, rund: true }, { art: 'regal', n: () => 2, w: 0.4, h: 1.6, wand: true }],
  flur: [{ art: 'truhe', n: fl => (fl > 10 ? 1 : 0), w: 0.9, h: 0.5, wand: true }],
  halle: [{ art: 'tisch', n: fl => Math.ceil(fl / 14), w: 3.0, h: 1.0, wand: false }, { art: 'kamin', n: () => 1, w: 2.0, h: 0.6, wand: true }, { art: 'saeule', n: fl => (fl > 40 ? 4 : 0), w: 0.6, h: 0.6, wand: false, rund: true }],
  altar: [{ art: 'altar', n: () => 1, w: 1.8, h: 0.9, wand: true }, { art: 'bank', n: fl => Math.max(2, Math.floor(fl / 5)), w: 2.4, h: 0.55, wand: false }, { art: 'saeule', n: fl => (fl > 30 ? 4 : 0), w: 0.6, h: 0.6, wand: false, rund: true }],
  kammer: [{ art: 'truhe', n: () => 1, w: 0.9, h: 0.5, wand: true }, { art: 'regal', n: () => 1, w: 0.4, h: 1.2, wand: true }],
  stall: [{ art: 'trog', n: fl => Math.ceil(fl / 10), w: 0.5, h: 1.6, wand: true }, { art: 'heu', n: fl => Math.ceil(fl / 12), w: 1.6, h: 1.2, wand: true }, { art: 'box', n: fl => Math.ceil(fl / 8), w: 1.2, h: 2.0, wand: false }],
  bad: [{ art: 'zuber', n: () => 1, w: 1.0, h: 1.0, wand: true, rund: true }, { art: 'truhe', n: () => 1, w: 0.7, h: 0.4, wand: true }],
  keller: [{ art: 'fass', n: fl => Math.ceil(fl / 3), w: 0.9, h: 0.9, wand: true, rund: true }, { art: 'kiste', n: fl => Math.ceil(fl / 5), w: 0.8, h: 0.8, wand: true }, { art: 'regal', n: () => 2, w: 0.4, h: 1.6, wand: true }],
  saal: [{ art: 'tisch', n: fl => Math.ceil(fl / 12), w: 3.2, h: 1.1, wand: false }, { art: 'kamin', n: () => 2, w: 2.0, h: 0.6, wand: true }, { art: 'saeule', n: fl => (fl > 50 ? 6 : 0), w: 0.6, h: 0.6, wand: false, rund: true }],
  wachraum: [{ art: 'tisch', n: () => 1, w: 1.4, h: 0.9, wand: false }, { art: 'bett', n: fl => Math.floor(fl / 8), w: 0.9, h: 1.9, wand: true }, { art: 'regal', n: () => 1, w: 0.4, h: 1.6, wand: true }],
  zelle: [{ art: 'bett', n: () => 1, w: 0.8, h: 1.8, wand: true }],
  raum: [{ art: 'truhe', n: () => 1, w: 0.9, h: 0.5, wand: true }, { art: 'tisch', n: fl => (fl > 12 ? 1 : 0), w: 1.3, h: 0.9, wand: false }],
};

const BODEN: Record<RaumArt, string> = {
  wohnraum: '#e2cb98', schlafraum: '#e4cf9f', kueche: '#d9c39a', vorrat: '#d4c29a', werkstatt: '#d8c49c', schankraum: '#e0c58e',
  laden: '#e4cd9c', lager: '#d3c29b', flur: '#e6d5ad', halle: '#dfcb9c', altar: '#ddd3b8', kammer: '#d8c8a0', stall: '#d8cf9a',
  bad: '#cfd2b6', keller: '#c8bca2', saal: '#e2cd9e', wachraum: '#d6c9a6', zelle: '#c9bea6', raum: '#e0ccA0',
};

/** Möbel eines Raums platzieren: Wandplätze zuerst, dann freie Plätze, ohne Türzonen und Überlappung. */
function moebelFuer(rng: Rng, raum: Raum, sperren: Rechteck[]): Moebel[] {
  const r = raum.r;
  const fl = r.w * r.h;
  const aus: Moebel[] = [];
  const rand = 0.22;
  if (raum.art === 'altar' && r.w >= 5 && r.h >= 5) {
    // Altar an der Nordwand, Bankreihen links und rechts eines Mittelgangs.
    aus.push({ art: 'altar', x: r.x + r.w / 2 - 0.9, y: r.y + 0.5, w: 1.8, h: 0.9 });
    const gang = 1.2;
    const bankB = Math.min(2.6, (r.w - gang - 1.0) / 2);
    for (let y = r.y + 2.6; y + 0.55 <= r.y + r.h - 0.9; y += 1.15)
      for (const x of [r.x + r.w / 2 - gang / 2 - bankB, r.x + r.w / 2 + gang / 2]) {
        const b: Moebel = { art: 'bank', x, y, w: bankB, h: 0.55 };
        if (bankB > 0.8 && !sperren.some(sp => schneidet(b, sp))) aus.push(b);
      }
    return aus;
  }
  for (const spec of AUSSTATTUNG[raum.art]) {
    const n = spec.n(fl);
    for (let i = 0; i < n; i++) {
      for (let versuch = 0; versuch < 40; versuch++) {
        let w = spec.w;
        let h = spec.h;
        let x: number;
        let y: number;
        if (spec.wand) {
          const seite = Math.floor(rng() * 4);
          if (seite < 2 && rng() < 0.5) { const t = w; w = h; h = t; }
          const lang = seite >= 2;
          const ww = lang ? spec.h : spec.w;
          const hh = lang ? spec.w : spec.h;
          // Wand wählen: 0 nord, 1 süd, 2 west, 3 ost; Möbel liegt mit der langen Seite an der Wand.
          const [a, b] = lang ? [Math.min(ww, hh), Math.max(ww, hh)] : [Math.max(ww, hh), Math.min(ww, hh)];
          if (seite === 0) { w = a; h = b; x = r.x + rand + rng() * Math.max(0, r.w - 2 * rand - w); y = r.y + rand; }
          else if (seite === 1) { w = a; h = b; x = r.x + rand + rng() * Math.max(0, r.w - 2 * rand - w); y = r.y + r.h - rand - h; }
          else if (seite === 2) { h = a; w = b; x = r.x + rand; y = r.y + rand + rng() * Math.max(0, r.h - 2 * rand - h); }
          else { h = a; w = b; x = r.x + r.w - rand - w; y = r.y + rand + rng() * Math.max(0, r.h - 2 * rand - h); }
        } else {
          if (rng() < 0.5) { const t = w; w = h; h = t; }
          x = r.x + 0.8 + rng() * Math.max(0, r.w - 1.6 - w);
          y = r.y + 0.8 + rng() * Math.max(0, r.h - 1.6 - h);
        }
        const m: Moebel = { art: spec.art, x, y, w, h, rund: spec.rund };
        if (w > r.w - 0.3 || h > r.h - 0.3) continue;
        if (aus.some(o => schneidet(m, o, 0.25))) continue;
        if (sperren.some(s => schneidet(m, s))) continue;
        aus.push(m);
        break;
      }
    }
  }
  return aus;
}

function zeichneMoebel(m: Moebel, s: number, F: Palette): string {
  const x = m.x * s;
  const y = m.y * s;
  const w = m.w * s;
  const h = m.h * s;
  const sk = `stroke="${F.tinte}" stroke-width="1.1" stroke-linejoin="round"`;
  switch (m.art) {
    case 'bett': {
      const kopf = h >= w;
      return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="2" fill="#efe3c3" ${sk}/><rect x="${f(kopf ? x + 3 : x + 3)}" y="${f(kopf ? y + 3 : y + 3)}" width="${f(kopf ? w - 6 : w * 0.25)}" height="${f(kopf ? h * 0.2 : h - 6)}" rx="3" fill="#f7efd9" ${sk}/>`;
    }
    case 'tisch':
      return m.rund ? `<ellipse cx="${f(x + w / 2)}" cy="${f(y + h / 2)}" rx="${f(w / 2)}" ry="${f(h / 2)}" fill="${F.holz}" ${sk}/>` : `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${F.holz}" ${sk}/><path d="M${f(x + 2)} ${f(y + h * 0.5)}H${f(x + w - 2)}" stroke="${F.rumpf}" stroke-width=".7" fill="none"/>`;
    case 'theke':
      return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${F.rumpf}" ${sk}/><path d="M${f(x + 2)} ${f(y + 2)}H${f(x + w - 2)}V${f(y + h - 2)}H${f(x + 2)}Z" fill="none" stroke="${F.holz}" stroke-width=".8"/>`;
    case 'regal':
      return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${F.rumpf}" ${sk}/>${w > h ? `<path d="M${f(x)} ${f(y + h / 2)}H${f(x + w)}" stroke="${F.holz}" stroke-width=".7"/>` : `<path d="M${f(x + w / 2)} ${f(y)}V${f(y + h)}" stroke="${F.holz}" stroke-width=".7"/>`}`;
    case 'truhe':
    case 'kiste':
      return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${F.holz}" ${sk}/><path d="M${f(x)} ${f(y)}L${f(x + w)} ${f(y + h)}M${f(x + w)} ${f(y)}L${f(x)} ${f(y + h)}" stroke="${F.rumpf}" stroke-width=".6" fill="none"/>`;
    case 'fass':
    case 'zuber':
      return `<ellipse cx="${f(x + w / 2)}" cy="${f(y + h / 2)}" rx="${f(w / 2)}" ry="${f(h / 2)}" fill="${m.art === 'zuber' ? '#b9cfc4' : F.holz}" ${sk}/><ellipse cx="${f(x + w / 2)}" cy="${f(y + h / 2)}" rx="${f(w / 3.2)}" ry="${f(h / 3.2)}" fill="none" stroke="${F.rumpf}" stroke-width=".8"/>`;
    case 'herd':
    case 'esse':
      return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${F.stein}" ${sk}/><circle cx="${f(x + w / 2)}" cy="${f(y + h / 2)}" r="${f(Math.min(w, h) * 0.28)}" fill="#6a5a48" stroke="${F.tinte}" stroke-width=".8"/>`;
    case 'kamin':
      return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${F.stein}" ${sk}/><rect x="${f(x + w * 0.2)}" y="${f(y + h * 0.2)}" width="${f(w * 0.6)}" height="${f(h * 0.6)}" fill="#6a5a48"/>`;
    case 'altar':
      return `<rect x="${f(x - 3)}" y="${f(y - 3)}" width="${f(w + 6)}" height="${f(h + 6)}" fill="${F.platz}" ${sk}/><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${F.stein}" ${sk}/>`;
    case 'bank':
      return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${F.holz}" ${sk}/>`;
    case 'saeule':
      return `<circle cx="${f(x + w / 2)}" cy="${f(y + h / 2)}" r="${f(w / 2)}" fill="${F.stein}" ${sk}/>`;
    case 'werkbank':
      return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${F.rumpf}" ${sk}/><circle cx="${f(x + w / 2)}" cy="${f(y + h * 0.3)}" r="${f(Math.min(w, h) * 0.2)}" fill="${F.stein}" stroke="${F.tinte}" stroke-width=".7"/>`;
    case 'trog':
      return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="3" fill="#b9cfc4" ${sk}/>`;
    case 'heu':
      return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="#d9cb7e" ${sk}/><path d="M${f(x + 3)} ${f(y + h * 0.33)}H${f(x + w - 3)}M${f(x + 3)} ${f(y + h * 0.66)}H${f(x + w - 3)}" stroke="#a89850" stroke-width=".8"/>`;
    case 'box':
      return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="none" stroke="${F.rumpf}" stroke-width="1.2" stroke-dasharray="5 3"/>`;
    default:
      return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${F.holz}" ${sk}/>`;
  }
}

/** Zeichnet eine Etage in ihr Koordinatensystem (Meter × Maßstab, Ursprung links oben des Gebäudes). */
function zeichneEtage(e: Etage, plan: Gebaeudeplan, s: number, F: Palette, rng: Rng, ox: number, oy: number): { svg: string; marken: { nr: number; name: string; x: number; y: number; kurz: string }[] } {
  const t: string[] = [];
  const marken: { nr: number; name: string; x: number; y: number; kurz: string }[] = [];
  const W = plan.breite * s;
  const H = plan.tiefe * s;
  const dick = Math.max(2.2, 0.17 * s); // Innenwand
  const aussen = Math.max(4.5, 0.34 * s);
  t.push(`<g transform="translate(${f(ox)} ${f(oy)})">`);
  // Boden je Raum
  for (const r of e.raeume) t.push(`<rect x="${f(r.r.x * s)}" y="${f(r.r.y * s)}" width="${f(r.r.w * s)}" height="${f(r.r.h * s)}" fill="${BODEN[r.art]}"/>`);
  // Raster (1 m) fein
  const raster: string[] = [];
  for (let x = 1; x < plan.breite; x++) raster.push(`M${f(x * s)} 0V${f(H)}`);
  for (let y = 1; y < plan.tiefe; y++) raster.push(`M0 ${f(y * s)}H${f(W)}`);
  t.push(`<path d="${raster.join('')}" stroke="${F.tinte}" stroke-opacity=".08" stroke-width=".7" fill="none"/>`);
  // Möbel (vor den Wänden, damit die Wände saubere Kanten behalten)
  const sperren: Rechteck[] = e.tueren.map(d => d.waagerecht ? { x: d.x - d.breite / 2 - 0.2, y: d.y - 1.0, w: d.breite + 0.4, h: 2.0 } : { x: d.x - 1.0, y: d.y - d.breite / 2 - 0.2, w: 2.0, h: d.breite + 0.4 });
  for (const r of e.raeume) {
    if (r.treppenhaus) {
      // Treppe oben im Treppenhaus: Stufen quer zur Länge.
      const x0 = r.r.x * s + 0.2 * s;
      const w = r.r.w * s - 0.4 * s;
      const stufen = Math.round(TREPPEN_LAENGE / 0.28);
      const stufenH = (TREPPEN_LAENGE * s) / stufen;
      const stufe = Array.from({ length: stufen }, (_, i) => `M${f(x0)} ${f(r.r.y * s + 0.2 * s + i * stufenH)}H${f(x0 + w)}`).join('');
      t.push(`<rect x="${f(x0)}" y="${f(r.r.y * s + 0.2 * s)}" width="${f(w)}" height="${f(TREPPEN_LAENGE * s)}" fill="${F.platz}" stroke="${F.tinte}" stroke-width="1.1"/><path d="${stufe}" stroke="${F.tinte}" stroke-width=".7" fill="none"/>`);
      continue;
    }
    for (const m of moebelFuer(rng, r, sperren)) t.push(zeichneMoebel(m, s, F));
  }
  // Innenwände: Umriss jedes Raums
  for (const r of e.raeume) t.push(`<rect x="${f(r.r.x * s)}" y="${f(r.r.y * s)}" width="${f(r.r.w * s)}" height="${f(r.r.h * s)}" fill="none" stroke="${F.tinte}" stroke-width="${f(dick)}" stroke-linejoin="miter"/>`);
  // Türen schneiden Lücken in die Wand; Außenwand darüber.
  t.push(`<rect x="0" y="0" width="${f(W)}" height="${f(H)}" fill="none" stroke="${F.tinte}" stroke-width="${f(aussen)}" stroke-linejoin="miter"/>`);
  for (const d of e.tueren) {
    const breite = d.breite * s;
    const luecke = (d.aussen ? aussen : dick) + 3;
    const bodenFarbe = BODEN[e.raeume[d.von]!.art];
    if (d.waagerecht) {
      t.push(`<rect x="${f(d.x * s - breite / 2)}" y="${f(d.y * s - luecke / 2)}" width="${f(breite)}" height="${f(luecke)}" fill="${bodenFarbe}"/>`);
      t.push(`<path d="M${f(d.x * s - breite / 2)} ${f(d.y * s)}A${f(breite)} ${f(breite)} 0 0 1 ${f(d.x * s - breite / 2 + breite)} ${f(d.y * s - breite)}" fill="none" stroke="${F.tinte}" stroke-width="1" /><path d="M${f(d.x * s - breite / 2)} ${f(d.y * s)}V${f(d.y * s - breite)}" stroke="${F.tinte}" stroke-width="1.6"/>`);
    } else {
      t.push(`<rect x="${f(d.x * s - luecke / 2)}" y="${f(d.y * s - breite / 2)}" width="${f(luecke)}" height="${f(breite)}" fill="${bodenFarbe}"/>`);
      t.push(`<path d="M${f(d.x * s)} ${f(d.y * s - breite / 2)}A${f(breite)} ${f(breite)} 0 0 1 ${f(d.x * s + breite)} ${f(d.y * s + breite / 2)}" fill="none" stroke="${F.tinte}" stroke-width="1"/><path d="M${f(d.x * s)} ${f(d.y * s - breite / 2)}H${f(d.x * s + breite)}" stroke="${F.tinte}" stroke-width="1.6"/>`);
    }
  }
  for (const fe of e.fenster) {
    const b = fe.breite * s;
    if (fe.waagerecht) t.push(`<rect x="${f(fe.x * s - b / 2)}" y="${f(fe.y * s - aussen / 2)}" width="${f(b)}" height="${f(aussen)}" fill="#cfe0dc" stroke="${F.tinte}" stroke-width="1"/><path d="M${f(fe.x * s - b / 2)} ${f(fe.y * s)}H${f(fe.x * s + b / 2)}" stroke="${F.tinte}" stroke-width=".7"/>`);
    else t.push(`<rect x="${f(fe.x * s - aussen / 2)}" y="${f(fe.y * s - b / 2)}" width="${f(aussen)}" height="${f(b)}" fill="#cfe0dc" stroke="${F.tinte}" stroke-width="1"/><path d="M${f(fe.x * s)} ${f(fe.y * s - b / 2)}V${f(fe.y * s + b / 2)}" stroke="${F.tinte}" stroke-width=".7"/>`);
  }
  // Nummern und Namen
  for (const r of e.raeume) {
    const bx = (r.r.x + 0.9) * s;
    const by = (r.r.y + 0.9) * s;
    const px = Math.min(bx, (r.r.x + r.r.w / 2) * s);
    t.push(`<circle cx="${f(px)}" cy="${f(by)}" r="9" fill="${F.tinte}" stroke="${F.pergament}" stroke-width="1.5"/><text x="${f(px)}" y="${f(by + 4)}" text-anchor="middle" font-family="${SCHRIFT}" font-size="11" font-weight="700" fill="${F.pergament}">${r.nr}</text>`);
    marken.push({ nr: r.nr, name: r.name, x: Math.round(ox + px), y: Math.round(oy + by), kurz: r.kurz });
    if (r.r.w * s >= r.name.length * 6.2 + 26 && !r.treppenhaus)
      t.push(`<text x="${f(px + 13)}" y="${f(by + 4)}" font-family="${SCHRIFT}" font-size="12" font-style="italic" fill="${F.text}" stroke="${BODEN[r.art]}" stroke-width="3" paint-order="stroke">${r.name}</text>`);
  }
  t.push('</g>');
  return { svg: t.join(''), marken };
}

export interface GebaeudeKarte {
  svg: string;
  breite: number;
  hoehe: number;
  marken: { nr: number; name: string; art: 'raum'; x: number; y: number; kurz: string }[];
}

export function rendereGebaeude(plan: Gebaeudeplan): GebaeudeKarte {
  const F: Palette = { ...FARBE, ...PALETTE[plan.gelaende] };
  const n = plan.etagen.length;
  // Zeichenfläche unter dem Titel, über dem Rand; Platz für Etagenbeschriftung.
  const x0 = 70;
  const y0 = 120;
  const flaecheB = WIDTH - 2 * x0;
  const flaecheH = HEIGHT - y0 - 120;
  // Etagen nebeneinander oder untereinander: was den größeren Maßstab ergibt.
  const massstabFuer = (sp: number) => {
    const ze = Math.ceil(n / sp);
    return Math.min(64, (flaecheB / sp - 40) / plan.breite, (flaecheH / ze - 60) / plan.tiefe);
  };
  const optionen = (n === 1 ? [1] : n === 2 ? [1, 2] : [2, 3]).filter(sp => sp <= n);
  const spalten = optionen.reduce((best, sp) => (massstabFuer(sp) > massstabFuer(best) ? sp : best), optionen[0]!);
  const zeilen = Math.ceil(n / spalten);
  const zelleB = flaecheB / spalten;
  const zelleH = flaecheH / zeilen;
  const s = massstabFuer(spalten);
  const t: string[] = [];
  const marken: GebaeudeKarte['marken'] = [];
  t.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="${F.pergament}"/><rect width="${WIDTH}" height="${HEIGHT}" filter="url(#papier)"/>`);
  plan.etagen.forEach((e, i) => {
    const sp = i % spalten;
    const ze = Math.floor(i / spalten);
    const ox = x0 + sp * zelleB + (zelleB - plan.breite * s) / 2;
    const oy = y0 + ze * zelleH + 40 + (zelleH - 60 - plan.tiefe * s) / 2;
    const rng = createRng(`${plan.seed}#moebel${i}`);
    const z = zeichneEtage(e, plan, s, F, rng, ox, oy);
    t.push(z.svg);
    for (const m of z.marken) marken.push({ ...m, art: 'raum' });
    if (e.name) t.push(`<text x="${f(ox)}" y="${f(oy - 14)}" font-family="${SCHRIFT}" font-size="20" letter-spacing="3" fill="${F.text}">${e.name.toUpperCase()}</text>`);
  });
  t.push(`<rect width="${WIDTH}" height="${HEIGHT}" filter="url(#koernung)" opacity=".5"/>`);
  t.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#vignette)"/>`);
  t.push(rahmen(F), titel(plan.name, F), massstab(F, 1 / s, [1, 2, 5, 10, 20]), kompass(F));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">${defs(F)}${t.join('')}</svg>`;
  return { svg, breite: WIDTH, hoehe: HEIGHT, marken };
}

void RAND;
