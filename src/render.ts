import { HEIGHT, WIDTH, type Point } from './geometry';
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
  grenze: '#9c8444',
  strasse: '#7a5f32',
};

const pfad = (pts: Point[], schliessen: boolean) =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('') + (schliessen ? 'Z' : '');

function raster(): string {
  const linien: string[] = [];
  for (let x = 0; x <= WIDTH; x += 125) linien.push(`M${x} 0V${HEIGHT}`);
  for (let y = 0; y <= HEIGHT; y += 125) linien.push(`M0 ${y}H${WIDTH}`);
  return `<path d="${linien.join('')}" stroke="${FARBE.raster}" stroke-width="1" opacity=".55" fill="none"/>`;
}

function massstab(): string {
  // 125 Einheiten = 125 m, Leiste 0 / 250 / 500 m wie in der Stilvorlage
  const x0 = 28;
  const y0 = 78;
  return `<line x1="${x0}" y1="${y0}" x2="${x0 + 250}" y2="${y0}" stroke="${FARBE.text}" stroke-width="1.5"/>` +
    [0, 125, 250].map(d => `<line x1="${x0 + d}" y1="${y0 - 6}" x2="${x0 + d}" y2="${y0}" stroke="${FARBE.text}"/>`).join('') +
    ['0 m', '250', '500'].map((t, i) => `<text x="${x0 + i * 125}" y="${y0 - 12}" font-size="14" text-anchor="middle" fill="${FARBE.text}">${t}</text>`).join('');
}

export function rendereSvg(u: Stadtplan, name = u.name): string {
  const teile: string[] = [];
  teile.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="${FARBE.pergament}"/>`, raster());

  if (u.meer) teile.push(`<path d="${pfad(u.meer, true)}" fill="${FARBE.wasser}" stroke="${FARBE.wasserRand}" stroke-width="2"/>`);
  if (u.fluss) teile.push(`<path d="${pfad(u.fluss.flaeche, true)}" fill="${FARBE.wasser}" stroke="${FARBE.wasserRand}" stroke-width="1.5"/>`);

  teile.push(`<path d="${u.grenzen.map(([a, b]) => `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`).join('')}" stroke="${FARBE.grenze}" stroke-width="1.5" stroke-dasharray="6 5" fill="none"/>`);
  for (const l of u.strassen) teile.push(`<path d="${pfad(l, false)}" stroke="${FARBE.strasse}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);

  if (u.mauer) {
    teile.push(`<path d="${pfad(u.mauer, u.mauerGeschlossen)}" fill="none" stroke="${FARBE.mauer}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>`);
    for (const p of u.mauer) teile.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="6" fill="${FARBE.mauer}"/>`);
  }

  const schrift = `font-family="Georgia, 'Times New Roman', serif" letter-spacing="3" font-size="19" text-anchor="middle" fill="${FARBE.text}"`;
  for (const v of u.viertel) if (v.name) teile.push(`<text x="${v.mitte.x.toFixed(1)}" y="${v.mitte.y.toFixed(1)}" ${schrift}>${v.name.toUpperCase()}</text>`);

  teile.push(
    `<g font-family="Georgia, 'Times New Roman', serif">`,
    `<rect x="8" y="8" width="256" height="112" fill="${FARBE.kartusche}" stroke="${FARBE.mauer}" stroke-width="2"/>`,
    `<text x="136" y="50" font-size="24" text-anchor="middle" fill="${FARBE.text}">${name}</text>`,
    massstab(),
    `</g>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">${teile.join('')}</svg>`;
}
