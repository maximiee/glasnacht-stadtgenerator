import { describe, expect, it } from 'vitest';
import { KAMMER_ARTEN, erzeugeHoehle, hoehleDateiAlsKarte, liesHoehle } from './index';

const hoehle = (seed: string, n = 7) => ({
  version: 1,
  name: 'Probehöhle',
  seed,
  kammern: Array.from({ length: n }, (_, i) => ({ name: `Kammer ${i + 1}`, art: KAMMER_ARTEN[i % KAMMER_ARTEN.length], kurz: 'Etwas.' })),
});

describe('Höhle: Eingabe', () => {
  it('meldet Fehler verständlich', () => {
    expect(() => liesHoehle({ version: 2, name: 'H', kammern: [{ name: 'A' }] })).toThrow(/Version/);
    expect(() => liesHoehle({ version: 1, name: 'H' })).toThrow(/kammern/);
    expect(() => liesHoehle({ version: 1, name: 'H', kammern: [{ name: 'A', art: 'thron' }] })).toThrow(/art/);
    expect(() => liesHoehle({ version: 1, name: 'H', kammern: [{ name: 'A' }, { name: 'A' }] })).toThrow(/doppelt/);
    expect(() => liesHoehle({ version: 1, name: 'H', kammern: [{ name: 'A', durchmesser: 1 }] })).toThrow(/durchmesser/);
    expect(() => liesHoehle({ version: 1, name: 'H', kammern: [{ name: 'A' }], verbindungen: [['A', 'Z']] })).toThrow(/verbindungen/);
  });
});

describe('Höhle: Plan', () => {
  it('ist bei gleichem Seed gleich', () => {
    expect(erzeugeHoehle(liesHoehle(hoehle('s1')))).toEqual(erzeugeHoehle(liesHoehle(hoehle('s1'))));
    expect(erzeugeHoehle(liesHoehle(hoehle('s1')))).not.toEqual(erzeugeHoehle(liesHoehle(hoehle('s2'))));
  });

  it('verbindet alle Kammern und überlappt keine Mitten', () => {
    for (let s = 0; s < 30; s++) {
      const p = erzeugeHoehle(liesHoehle(hoehle(`t${s}`, 3 + (s % 12))));
      const erreicht = new Set([0]);
      for (let rund = 0; rund < p.kammern.length; rund++) {
        for (const g of p.gaenge) {
          if (erreicht.has(g.von)) erreicht.add(g.nach);
          if (erreicht.has(g.nach)) erreicht.add(g.von);
        }
      }
      expect(erreicht.size).toBe(p.kammern.length);
      for (const [i, a] of p.kammern.entries()) for (const b of p.kammern.slice(i + 1)) {
        expect(Math.hypot(a.mitte.x - b.mitte.x, a.mitte.y - b.mitte.y)).toBeGreaterThan(Math.min(a.radius, b.radius));
      }
      expect(p.zugang.length).toBeGreaterThan(1);
    }
  });
});

describe('Höhle: Zeichnung', () => {
  it('zeichnet jede Kammerart und nummeriert die Marken innerhalb der Karte', () => {
    const k = hoehleDateiAlsKarte(hoehle('r', KAMMER_ARTEN.length));
    expect(k.svg.startsWith('<svg')).toBe(true);
    expect(k.marken.map(m => m.nr)).toEqual(KAMMER_ARTEN.map((_, i) => i + 1));
    for (const m of k.marken) {
      expect(m.x).toBeGreaterThan(0);
      expect(m.x).toBeLessThan(k.breite);
      expect(m.y).toBeGreaterThan(0);
      expect(m.y).toBeLessThan(k.hoehe);
    }
  });
});
