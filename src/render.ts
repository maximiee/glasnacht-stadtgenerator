import { HEIGHT, WIDTH, inPolygon, type Point } from './geometry';
import { legeBeschriftung } from './beschriftung';
import type { Stadtplan } from './stadtplan';

// Farben nach docs/Stilvorlage.md
const FARBE = {
  pergament: '#fdefbf',
  raster: '#c9b982',
  wasser: '#6a9484',
  wasserRand: '#4f7566',
  mauer: '#4d514f',
  kartusche: '#f1f0d8',
  text: '#2e3430',
  haus: '#c98a5a',
  hausRand: '#7a4f33',
  bruecke: '#d8c586',
  gasse: '#b99a5e',
  strasse: '#7a5f32',
};

/** Abweichende Farben je Gelände (Rest wie `FARBE`). */
const PALETTE: Record<Stadtplan['gelaende'], Partial<typeof FARBE>> = {
  gras: {},
  wueste: { pergament: '#f3dca4', raster: '#d1b878', haus: '#dcb170', hausRand: '#8a6a3a', gasse: '#c9a867', strasse: '#a98650', wasser: '#74a39a' },
  eis: { pergament: '#e6edf0', raster: '#aebfc9', haus: '#dfe6ea', hausRand: '#5e7482', bruecke: '#c8d6de', gasse: '#9fb1bd', strasse: '#6f8493', wasser: '#7fa9bc', wasserRand: '#5d8599', kartusche: '#f4f7f8' },
  gebirge: { pergament: '#eadfc3', raster: '#bcae8a', haus: '#b99a80', hausRand: '#5e4a3a', gasse: '#a8967a', strasse: '#6b5a48' },
};

const pfad = (pts: Point[], schliessen: boolean) =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('') + (schliessen ? 'Z' : '');

function raster(F: typeof FARBE): string {
  const linien: string[] = [];
  for (let x = 0; x <= WIDTH; x += 125) linien.push(`M${x} 0V${HEIGHT}`);
  for (let y = 0; y <= HEIGHT; y += 125) linien.push(`M0 ${y}H${WIDTH}`);
  return `<path d="${linien.join('')}" stroke="${F.raster}" stroke-width="1" opacity=".55" fill="none"/>`;
}

function massstab(F: typeof FARBE): string {
  // 125 Einheiten = 125 m, Leiste 0 / 250 / 500 m wie in der Stilvorlage
  const x0 = 28;
  const y0 = 78;
  return `<line x1="${x0}" y1="${y0}" x2="${x0 + 250}" y2="${y0}" stroke="${F.text}" stroke-width="1.5"/>` +
    [0, 125, 250].map(d => `<line x1="${x0 + d}" y1="${y0 - 6}" x2="${x0 + d}" y2="${y0}" stroke="${F.text}"/>`).join('') +
    ['0 m', '250', '500'].map((t, i) => `<text x="${x0 + i * 125}" y="${y0 - 12}" font-size="14" text-anchor="middle" fill="${F.text}">${t}</text>`).join('');
}

export function rendereSvg(u: Stadtplan, name = u.name): string {
  const F = { ...FARBE, ...PALETTE[u.gelaende] };
  const teile: string[] = [];
  teile.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="${F.pergament}"/>`, raster(F));

  if (u.meer) teile.push(`<path d="${pfad(u.meer, true)}" fill="${F.wasser}" stroke="${F.wasserRand}" stroke-width="2"/>`);
  if (u.fluss) teile.push(`<path d="${pfad(u.fluss.flaeche, true)}" fill="${F.wasser}" stroke="${F.wasserRand}" stroke-width="1.5"/>`);

  teile.push(`<path d="${u.grenzen.map(([a, b]) => `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`).join('')}" stroke="${F.gasse}" stroke-width="3" stroke-linecap="round" fill="none"/>`);
  teile.push(`<path d="${u.haeuser.map(h => 'M' + h.ecken.map(e => `${e.x.toFixed(1)} ${e.y.toFixed(1)}`).join('L') + 'Z').join('')}" fill="${F.haus}" stroke="${F.hausRand}" stroke-width=".7"/>`);
  teile.push(`<path d="${u.orte.map(o => 'M' + o.ecken.map(e => `${e.x.toFixed(1)} ${e.y.toFixed(1)}`).join('L') + 'Z').join('')}" fill="${F.mauer}" stroke="${F.text}" stroke-width="1"/>`);
  if (u.fluss) {
    const bruecken = u.strassen.flatMap(l => l.slice(1).map((b, i) => [l[i]!, b] as const).filter(([a, b]) => inPolygon({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, u.fluss!.flaeche)));
    for (const [a, b] of bruecken) teile.push(`<path d="M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}" stroke="${F.bruecke}" stroke-width="12" stroke-linecap="butt"/>`);
  }
  for (const l of u.strassen) teile.push(`<path d="${pfad(l, false)}" stroke="${F.strasse}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);

  if (u.mauer) {
    teile.push(`<path d="${pfad(u.mauer, u.mauerGeschlossen)}" fill="none" stroke="${F.mauer}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>`);
    for (const p of u.mauer) teile.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="6" fill="${F.mauer}"/>`);
  }

  const grundSchrift = `font-family="Georgia, 'Times New Roman', serif" fill="${F.text}" stroke="${F.pergament}" paint-order="stroke" stroke-linejoin="round"`;
  for (const l of legeBeschriftung(u)) {
    const gross = l.art === 'viertel';
    const attr = gross
      ? `${grundSchrift} letter-spacing="3" font-size="19" stroke-width="4"`
      : `${grundSchrift} font-size="13" font-style="italic" stroke-width="3.5"`;
    const hoehe = gross ? 22 : 15;
    const spans = l.zeilen.map((z, i) => `<tspan x="${l.x.toFixed(1)}" dy="${i ? hoehe : 0}">${z}</tspan>`).join('');
    teile.push(`<text x="${l.x.toFixed(1)}" y="${l.y.toFixed(1)}" text-anchor="${l.anker}" ${attr}>${spans}</text>`);
  }

  teile.push(
    `<g font-family="Georgia, 'Times New Roman', serif">`,
    `<rect x="8" y="8" width="256" height="112" fill="${F.kartusche}" stroke="${F.mauer}" stroke-width="2"/>`,
    `<text x="136" y="50" font-size="24" text-anchor="middle" fill="${F.text}">${name}</text>`,
    massstab(F),
    `</g>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">${teile.join('')}</svg>`;
}
