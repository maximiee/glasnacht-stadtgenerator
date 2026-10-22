import { HEIGHT, WIDTH, inPolygon, offsetLine, type Point } from './geometry';
import { legeBeschriftung } from './beschriftung';
import type { Stadtplan } from './stadtplan';

// Farben im Stil alter Pergamentkarten (siehe docs/Stilvorlage.md)
const FARBE = {
  pergament: '#ecd9a6',
  rand: '#d4b97a',
  wasser: '#a9c4b4',
  wasserRand: '#3f5b50',
  tinte: '#3a2d1f',
  stein: '#c8bba2',
  turm: '#d8cdb6',
  text: '#3a2d1f',
  dach1: '#b5694a',
  dach2: '#a35a3d',
  dach3: '#c4835a',
  haus: '#b5694a',
  hausRand: '#4a2f20',
  bruecke: '#e2cf96',
  gasse: '#b99a5e',
  strasse: '#8a6a3c',
  baum: '#6f7f4c',
  baumRand: '#3c4a2a',
  park: '#b9c68a',
  parkRand: '#566b36',
  platz: '#dfd2b0',
  holz: '#97724a',
  rumpf: '#6d4f33',
  segel: '#f2e9d0',
};

/** Abweichende Farben je Gelände (Rest wie `FARBE`). */
const PALETTE: Record<Stadtplan['gelaende'], Partial<typeof FARBE>> = {
  gras: {},
  wueste: { pergament: '#f0d79c', rand: '#cfac66', dach1: '#d2a468', dach2: '#c4935a', dach3: '#dcb77c', gasse: '#c9a867', strasse: '#a58048', wasser: '#a8c8bc', baum: '#8a8a4c', baumRand: '#4f4f2a', park: '#c3c88a', platz: '#e6d3a2' },
  eis: { pergament: '#e4ebed', rand: '#b9c8d0', dach1: '#d6dee3', dach2: '#c5d0d8', dach3: '#e8eef1', hausRand: '#4c6272', stein: '#c0cdd4', gasse: '#9fb1bd', strasse: '#6f8493', bruecke: '#c8d6de', wasser: '#b3cfdc', wasserRand: '#4b7488', tinte: '#2f3d48', text: '#2f3d48', baum: '#9db3b0', baumRand: '#4c6a6a', park: '#d3dedc', parkRand: '#6a8484', platz: '#dfe7ea' },
  gebirge: { pergament: '#e5d8b8', rand: '#c3b08a', dach1: '#a98870', dach2: '#98785f', dach3: '#b99a80', hausRand: '#4a382c', gasse: '#a8967a', strasse: '#6b5a48', baum: '#697a4a', baumRand: '#3a4a2a' },
};

type Palette = typeof FARBE;

const f = (n: number) => n.toFixed(1);
const pfad = (pts: Point[], schliessen: boolean) => pts.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join('') + (schliessen ? 'Z' : '');
const polygone = (liste: Point[][], dx = 0, dy = 0) => liste.map(e => 'M' + e.map(p => `${f(p.x + dx)} ${f(p.y + dy)}`).join('L') + 'Z').join('');

const SCHRIFT = `Palatino, 'Palatino Linotype', 'Book Antiqua', Georgia, serif`;
const RAND = 22; // Abstand des inneren Rahmens zum Blattrand

function defs(F: Palette): string {
  return `<defs>
<filter id="papier" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency="0.011 0.016" numOctaves="4" seed="7" result="n"/>
<feColorMatrix in="n" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.30  0 0 0 0 0.14  0 0 0 1.1 -0.38"/>
</filter>
<filter id="koernung" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n"/>
<feColorMatrix in="n" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.18  0 0 0 0 0.08  0 0 0 0.5 -0.15"/>
</filter>
<radialGradient id="vignette" cx="50%" cy="50%" r="72%">
<stop offset="55%" stop-color="#6b4a1f" stop-opacity="0"/>
<stop offset="100%" stop-color="#6b4a1f" stop-opacity=".42"/>
</radialGradient>
<clipPath id="blatt"><rect x="${RAND}" y="${RAND}" width="${WIDTH - 2 * RAND}" height="${HEIGHT - 2 * RAND}"/></clipPath>
</defs>`;
}

/** Wellenlinien parallel zum Ufer, wie sie auf alten Karten das Wasser kennzeichnen. */
function wasserlinien(linie: Point[], wasser: Point[], F: Palette): string {
  const aussen = (d: number) => {
    const a = offsetLine(linie, d);
    const mitte = a[Math.floor(a.length / 2)]!;
    return inPolygon(mitte, wasser) ? a : offsetLine(linie, -d);
  };
  return [14, 30, 52, 80].map((d, i) => `<path d="${pfad(aussen(d), false)}" fill="none" stroke="${F.wasserRand}" stroke-width="${(1.6 - i * 0.25).toFixed(2)}" opacity="${(0.55 - i * 0.12).toFixed(2)}" stroke-dasharray="${i % 2 ? '10 7' : '22 9'}" stroke-linecap="round"/>`).join('');
}

function baum(p: Point, art: Stadtplan['gelaende'], F: Palette): string {
  if (art === 'eis' || art === 'gebirge') {
    return `<path d="M${f(p.x)} ${f(p.y - 9)}L${f(p.x + 5)} ${f(p.y + 3)}L${f(p.x - 5)} ${f(p.y + 3)}Z" fill="${F.baum}" stroke="${F.baumRand}" stroke-width=".8"/>`;
  }
  return `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="5.5" fill="${F.baum}" stroke="${F.baumRand}" stroke-width=".9"/>`;
}

function schiff(s: { mitte: Point; winkel: number; laenge: number; breite: number }, F: Palette): string {
  const l = s.laenge / 2;
  const w = s.breite / 2;
  const grad = (s.winkel * 180) / Math.PI;
  return `<g transform="translate(${f(s.mitte.x)} ${f(s.mitte.y)}) rotate(${f(grad)})">
<path d="M${f(-l)} ${f(-w)}L${f(l * 0.55)} ${f(-w)}L${f(l)} 0L${f(l * 0.55)} ${f(w)}L${f(-l)} ${f(w)}Z" transform="translate(1.6 1.6)" fill="#3a2410" opacity=".3"/>
<path d="M${f(-l)} ${f(-w)}L${f(l * 0.55)} ${f(-w)}L${f(l)} 0L${f(l * 0.55)} ${f(w)}L${f(-l)} ${f(w)}Z" fill="${F.rumpf}" stroke="${F.tinte}" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M${f(-l * 0.1)} ${f(-w * 0.9)}L${f(-l * 0.1)} ${f(w * 0.9)}L${f(l * 0.45)} 0Z" fill="${F.segel}" stroke="${F.tinte}" stroke-width="1"/>
<line x1="${f(-l * 0.1)}" y1="${f(-w * 0.9)}" x2="${f(-l * 0.1)}" y2="${f(w * 0.9)}" stroke="${F.tinte}" stroke-width="1.2"/>
</g>`;
}

function kompass(F: Palette): string {
  const cx = WIDTH - 96;
  const cy = HEIGHT - 96;
  const spitzen: string[] = [];
  for (let i = 0; i < 16; i++) {
    const w = (i * Math.PI) / 8 - Math.PI / 2;
    const r = i % 4 === 0 ? 62 : i % 2 === 0 ? 40 : 13;
    spitzen.push(`${f(cx + Math.cos(w) * r)} ${f(cy + Math.sin(w) * r)}`);
  }
  return `<g>
<circle cx="${cx}" cy="${cy}" r="46" fill="none" stroke="${F.tinte}" stroke-width="1.2"/>
<circle cx="${cx}" cy="${cy}" r="50" fill="none" stroke="${F.tinte}" stroke-width=".7"/>
<polygon points="${spitzen.join(' ')}" fill="${F.stein}" stroke="${F.tinte}" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M${cx} ${cy - 62}L${cx + 9} ${cy}L${cx} ${cy}Z M${cx + 62} ${cy}L${cx} ${cy + 9}L${cx} ${cy}Z M${cx} ${cy + 62}L${cx - 9} ${cy}L${cx} ${cy}Z M${cx - 62} ${cy}L${cx} ${cy - 9}L${cx} ${cy}Z" fill="${F.tinte}"/>
<text x="${cx}" y="${cy - 70}" font-family="${SCHRIFT}" font-size="18" font-weight="bold" text-anchor="middle" fill="${F.tinte}">N</text>
</g>`;
}

/** Maßstab: ein Balken aus drei Feldern mit runder Länge, passend zu den Metern je Einheit. */
function massstab(F: Palette, mProEinheit: number): string {
  const rund = [10, 20, 25, 50, 100, 200, 250, 500, 1000];
  const feldM = rund.find(m => m / mProEinheit >= 45) ?? 1000; // Feld mindestens 45 Einheiten breit
  const seg = feldM / mProEinheit;
  const x0 = 58;
  const y0 = HEIGHT - 70;
  const balken = [0, 1, 2].map(i => `<rect x="${f(x0 + i * seg)}" y="${y0}" width="${f(seg)}" height="8" fill="${i % 2 ? F.pergament : F.tinte}" stroke="${F.tinte}" stroke-width="1"/>`).join('');
  const zahlen = ['0', String(feldM), `${feldM * 2} m`].map((t, i) => `<text x="${f(x0 + i * seg)}" y="${y0 - 6}" font-family="${SCHRIFT}" font-size="13" text-anchor="${i === 2 ? 'start' : 'middle'}" fill="${F.text}">${t}</text>`).join('');
  return `<g><rect x="${x0 - 22}" y="${y0 - 28}" width="${f(3 * seg + 74)}" height="54" fill="${F.pergament}" fill-opacity=".85" stroke="${F.tinte}" stroke-width="1.2"/>${balken}${zahlen}</g>`;
}

function titel(name: string, F: Palette): string {
  const w = 380;
  const x = (WIDTH - w) / 2;
  return `<g>
<rect x="${x}" y="${RAND - 6}" width="${w}" height="66" fill="${F.pergament}" stroke="${F.tinte}" stroke-width="2.2"/>
<rect x="${x + 5}" y="${RAND - 1}" width="${w - 10}" height="56" fill="none" stroke="${F.tinte}" stroke-width=".9"/>
<text x="${WIDTH / 2}" y="${RAND + 36}" font-family="${SCHRIFT}" font-size="32" letter-spacing="4" text-anchor="middle" fill="${F.text}">${name.toUpperCase()}</text>
</g>`;
}

function rahmen(F: Palette): string {
  const ecken = [[RAND, RAND], [WIDTH - RAND, RAND], [RAND, HEIGHT - RAND], [WIDTH - RAND, HEIGHT - RAND]]
    .map(([x, y]) => `<rect x="${x! - 7}" y="${y! - 7}" width="14" height="14" fill="${F.tinte}"/>`).join('');
  return `<g fill="none" stroke="${F.tinte}">
<rect x="8" y="8" width="${WIDTH - 16}" height="${HEIGHT - 16}" stroke-width="3.5"/>
<rect x="${RAND}" y="${RAND}" width="${WIDTH - 2 * RAND}" height="${HEIGHT - 2 * RAND}" stroke-width="1.4"/>
</g>${ecken}`;
}

export function rendereSvg(u: Stadtplan, name = u.name): string {
  const F: Palette = { ...FARBE, ...PALETTE[u.gelaende] };
  const t: string[] = [];

  // Blatt: Pergament, Flecken, Körnung und dunkle Ränder
  t.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="${F.rand}"/>`);
  t.push(`<g clip-path="url(#blatt)"><rect width="${WIDTH}" height="${HEIGHT}" fill="${F.pergament}"/>`);
  t.push(`<rect width="${WIDTH}" height="${HEIGHT}" filter="url(#papier)" opacity=".55"/>`);

  // Wasser mit Wellenlinien
  if (u.meer) {
    t.push(`<path d="${pfad(u.meer, true)}" fill="${F.wasser}"/>`);
    const kueste = u.meer.slice(0, -2);
    t.push(wasserlinien(kueste, u.meer, F));
    t.push(`<path d="${pfad(kueste, false)}" fill="none" stroke="${F.wasserRand}" stroke-width="2.4" stroke-linejoin="round"/>`);
  }
  if (u.fluss) {
    t.push(`<path d="${pfad(u.fluss.flaeche, true)}" fill="${F.wasser}"/>`);
    t.push(`<path d="${pfad(u.fluss.flaeche, true)}" fill="none" stroke="${F.wasserRand}" stroke-width="2.2" stroke-linejoin="round"/>`);
    t.push(`<path d="${pfad(u.fluss.mittellinie, false)}" fill="none" stroke="${F.wasserRand}" stroke-width="1" opacity=".45" stroke-dasharray="14 10" stroke-linecap="round"/>`);
  }

  // Hafen: Stege und Schiffe im Wasser
  if (u.hafen) {
    for (const st of u.hafen.stege) t.push(`<path d="${polygone([st.ecken], 1.5, 1.5)}" fill="#3a2410" opacity=".3"/><path d="${polygone([st.ecken])}" fill="${F.holz}" stroke="${F.tinte}" stroke-width="1.3"/>`);
    for (const sc of u.hafen.schiffe) t.push(schiff(sc, F));
  }

  // Bäume außerhalb
  for (const p of u.baeume) t.push(baum(p, u.gelaende, F));

  // Kai, Plätze und Parks
  if (u.hafen) {
    t.push(`<path d="${pfad(u.hafen.kai, false)}" fill="none" stroke="${F.tinte}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`);
    t.push(`<path d="${pfad(u.hafen.kai, false)}" fill="none" stroke="${F.stein}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  for (const pl of u.plaetze) {
    t.push(`<path d="${pfad(pl.ecken, true)}" fill="${F.platz}" stroke="${F.tinte}" stroke-width="1.4" stroke-linejoin="round"/>`);
    if (pl.art === 'haupt') t.push(`<circle cx="${f(pl.mitte.x)}" cy="${f(pl.mitte.y)}" r="4.5" fill="${F.stein}" stroke="${F.tinte}" stroke-width="1.4"/>`);
  }
  for (const pk of u.parks) {
    t.push(`<path d="${pfad(pk.ecken, true)}" fill="${F.park}" stroke="${F.parkRand}" stroke-width="1.6" stroke-linejoin="round"/>`);
    if (pk.teich) t.push(`<path d="${pfad(pk.teich, true)}" fill="${F.wasser}" stroke="${F.wasserRand}" stroke-width="1.2"/>`);
    for (const b of pk.baeume) t.push(baum(b, u.gelaende, F));
  }

  // Gassen, Häuser mit Schatten, Orte
  t.push(`<path d="${u.grenzen.map(([a, b]) => `M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`).join('')}" stroke="${F.gasse}" stroke-width="3" stroke-linecap="round" fill="none"/>`);
  t.push(`<path d="${polygone(u.haeuser.map(h => h.ecken), 1.8, 1.8)}" fill="#3a2410" opacity=".28"/>`);
  const dachfarben = [F.dach1, F.dach2, F.dach3];
  dachfarben.forEach((farbe, k) => {
    t.push(`<path d="${polygone(u.haeuser.filter((_, i) => i % 3 === k).map(h => h.ecken))}" fill="${farbe}" stroke="${F.hausRand}" stroke-width=".8" stroke-linejoin="round"/>`);
  });
  t.push(`<path d="${polygone(u.orte.map(o => o.ecken), 2.4, 2.4)}" fill="#3a2410" opacity=".3"/>`);
  t.push(`<path d="${polygone(u.orte.map(o => o.ecken))}" fill="${F.stein}" stroke="${F.tinte}" stroke-width="1.6" stroke-linejoin="round"/>`);

  // Straßen mit Brücken
  if (u.fluss) {
    const bruecken = u.strassen.flatMap(l => l.slice(1).map((b, i) => [l[i]!, b] as const).filter(([a, b]) => inPolygon({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, u.fluss!.flaeche)));
    for (const [a, b] of bruecken) {
      t.push(`<path d="M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}" stroke="${F.tinte}" stroke-width="13" stroke-linecap="butt"/>`);
      t.push(`<path d="M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}" stroke="${F.bruecke}" stroke-width="9" stroke-linecap="butt"/>`);
    }
  }
  for (const l of u.strassen) {
    t.push(`<path d="${pfad(l, false)}" stroke="${F.tinte}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>`);
    t.push(`<path d="${pfad(l, false)}" stroke="${F.strasse}" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
  }

  // Mauer mit Türmen
  if (u.mauer) {
    const pfade = u.mauer.map(m => pfad(m.punkte, m.geschlossen)).join('');
    t.push(`<path d="${pfade}" fill="none" stroke="#3a2410" opacity=".3" stroke-width="10" stroke-linejoin="round" transform="translate(2 2)"/>`);
    t.push(`<path d="${pfade}" fill="none" stroke="${F.tinte}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>`);
    t.push(`<path d="${pfade}" fill="none" stroke="${F.stein}" stroke-width="5.4" stroke-linejoin="round" stroke-linecap="round"/>`);
    for (const m of u.mauer) for (const p of m.punkte) t.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="7.5" fill="${F.turm}" stroke="${F.tinte}" stroke-width="1.8"/>`);
    for (const tor of u.tore) t.push(`<rect x="${f(tor.x - 9)}" y="${f(tor.y - 9)}" width="18" height="18" fill="${F.turm}" stroke="${F.tinte}" stroke-width="2" transform="rotate(45 ${f(tor.x)} ${f(tor.y)})"/>`);
  }

  // Beschriftung
  const grund = `font-family="${SCHRIFT}" fill="${F.text}" stroke="${F.pergament}" paint-order="stroke" stroke-linejoin="round"`;
  for (const l of legeBeschriftung(u)) {
    const gross = l.art === 'viertel';
    const attr = gross ? `${grund} letter-spacing="3" font-size="19" font-weight="600" stroke-width="4.5"` : `${grund} font-size="13" font-style="italic" stroke-width="3.5"`;
    const hoehe = gross ? 22 : 15;
    const spans = l.zeilen.map((z, i) => `<tspan x="${f(l.x)}" dy="${i ? hoehe : 0}">${z}</tspan>`).join('');
    t.push(`<text x="${f(l.x)}" y="${f(l.y)}" text-anchor="${l.anker}" ${attr}>${spans}</text>`);
  }

  // Alterung über allem: Körnung und dunkle Ränder
  t.push(`<rect width="${WIDTH}" height="${HEIGHT}" filter="url(#koernung)" opacity=".5"/>`);
  t.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#vignette)"/></g>`);

  t.push(rahmen(F), titel(name, F), massstab(F, u.meterProEinheit), kompass(F));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">${defs(F)}${t.join('')}</svg>`;
}
