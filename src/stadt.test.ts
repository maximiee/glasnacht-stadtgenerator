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
