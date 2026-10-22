import { describe, expect, it } from 'vitest';
import { stadtDateiAlsSvg } from './index';
import { liesStadt, umrissOptionen } from './stadt';

describe('liesStadt', () => {
  it('liest eine minimale Stadt und nimmt den Namen als Seed', () => {
    const s = liesStadt('{"version":1,"name":"Kaimar"}');
    expect(umrissOptionen(s).seed).toBe('Kaimar');
  });

  it('lehnt falsche Version, fehlenden Namen und falsches Wasser ab', () => {
    expect(() => liesStadt('{"version":2,"name":"x"}')).toThrow(/Version/);
    expect(() => liesStadt('{"version":1}')).toThrow(/name/);
    expect(() => liesStadt('{"version":1,"name":"x","wasser":"see"}')).toThrow(/wasser/);
  });

  it('zeichnet dieselbe Stadt bei gleicher JSON', () => {
    const j = '{"version":1,"name":"Thalassa","wasser":"kueste"}';
    expect(stadtDateiAlsSvg(j)).toBe(stadtDateiAlsSvg(j));
  });
});

describe('Stadtplan', () => {
  it('benennt alle Viertel und setzt Straßen durch die Tore', async () => {
    const { erzeugeStadtplan } = await import('./stadtplan');
    const p = erzeugeStadtplan(liesStadt({ version: 1, name: 'T', tore: 4, viertel: [{ name: 'A', lage: 'nord' }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' }] }));
    expect(p.viertel.map(v => v.name).sort()).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(p.viertel.find(v => v.name === 'A')!.mitte.y).toBeLessThan(p.mitte.y);
    expect(p.strassen).toHaveLength(4);
    expect(p.grenzen.length).toBeGreaterThan(0);
  });
});

describe('Orte', () => {
  it('setzt Orte in ihr Viertel', async () => {
    const { erzeugeStadtplan } = await import('./stadtplan');
    const p = erzeugeStadtplan(liesStadt({ version: 1, name: 'T', viertel: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }], orte: [{ name: 'Leuchtturm', viertel: 'B' }, { name: 'Dom', viertel: 'C' }] }));
    expect(p.orte.map(o => o.name)).toEqual(['Leuchtturm', 'Dom']);
  });
});

describe('Lage des Wassers', () => {
  it('legt das Meer in die angegebene Himmelsrichtung', async () => {
    const { erzeugeStadtplan } = await import('./stadtplan');
    const mittel = (pts: { x: number; y: number }[]) => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });
    const west = erzeugeStadtplan(liesStadt({ version: 1, name: 'K', wasser: 'kueste', lage: 'west' }));
    expect(mittel(west.meer!).x).toBeLessThan(west.mitte.x);
    const nord = erzeugeStadtplan(liesStadt({ version: 1, name: 'K', wasser: 'kueste', lage: 'nord' }));
    expect(mittel(nord.meer!).y).toBeLessThan(nord.mitte.y);
  });
});

describe('Gelände', () => {
  it('nimmt bekanntes Gelände an und lehnt unbekanntes ab', () => {
    expect(liesStadt({ version: 1, name: 'D', gelaende: 'wueste' }).gelaende).toBe('wueste');
    expect(() => liesStadt({ version: 1, name: 'D', gelaende: 'lava' })).toThrow(/gelaende/);
  });
});
