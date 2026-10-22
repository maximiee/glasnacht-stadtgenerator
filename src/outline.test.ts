import { describe, expect, it } from 'vitest';
import { erzeugeUmriss } from './outline';
import { stadtAlsSvg } from './index';

describe('erzeugeUmriss', () => {
  it('ist bei gleichem Seed identisch', () => {
    expect(erzeugeUmriss({ seed: 'a' })).toEqual(erzeugeUmriss({ seed: 'a' }));
  });

  it('unterscheidet sich bei anderem Seed', () => {
    expect(erzeugeUmriss({ seed: 'a' }).mauer).not.toEqual(erzeugeUmriss({ seed: 'b' }).mauer);
  });

  it('erzeugt je nach Wasserart Fluss, Meer oder nichts', () => {
    expect(erzeugeUmriss({ seed: 1, wasser: 'fluss' }).fluss).not.toBeNull();
    expect(erzeugeUmriss({ seed: 1, wasser: 'kueste' }).meer).not.toBeNull();
    const k = erzeugeUmriss({ seed: 1, wasser: 'keins' });
    expect(k.fluss).toBeNull();
    expect(k.meer).toBeNull();
  });

  it('lässt die Mauer weg, wenn gewünscht', () => {
    expect(erzeugeUmriss({ seed: 1, mauer: false }).mauer).toBeNull();
  });

  it('liefert gültiges SVG', () => {
    expect(stadtAlsSvg({ seed: 7 }, 'Test')).toMatch(/^<svg[\s\S]*<\/svg>$/);
  });
});
