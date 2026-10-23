import { describe, expect, it } from 'vitest';
import { erzeugeRoute, liesRoute, routeDateiAlsKarte } from './index';

const orte = { A: { x: 200, y: 300 }, B: { x: 900, y: 500 }, C: { x: 1500, y: 1200 } };
const bild = { href: 'data:image/jpeg;base64,AA==', breite: 2048, hoehe: 1536 };
const route = {
  version: 1,
  name: 'Probe',
  stationen: [{ name: 'A', ort: 'A' }, { name: 'Furt', x: 700, y: 450, punkt: true }, { name: 'B', ort: 'B', weg: 'pfad' }, { name: 'C', ort: 'C' }],
};

describe('Route: Eingabe', () => {
  it('meldet Fehler verständlich', () => {
    expect(() => liesRoute({ version: 1, name: 'R', stationen: [{ name: 'A', x: 1, y: 1 }] })).toThrow(/zwei/);
    expect(() => liesRoute({ version: 1, name: 'R', stationen: [{ name: 'A' }, { name: 'B', x: 1, y: 1 }] })).toThrow(/ort/);
    expect(() => liesRoute({ version: 1, name: 'R', stationen: [{ name: 'A', x: 1, y: 1 }, { name: 'B', x: 2, y: 2, weg: 'fliegen' }] })).toThrow(/weg/);
    expect(() => liesRoute({ version: 1, name: 'R', stationen: [{ name: 'A', x: 1, y: 1, punkt: true }, { name: 'B', x: 2, y: 2 }] })).toThrow(/Zwischenpunkt/);
  });
  it('kennt nur Orte der Karte und nur Punkte darin', () => {
    expect(() => erzeugeRoute(liesRoute({ ...route, stationen: [{ name: 'A', ort: 'A' }, { name: 'X', ort: 'Nirgends' }] }), orte, bild, 1.2)).toThrow(/Nirgends/);
    expect(() => routeDateiAlsKarte({ ...route, stationen: [{ name: 'A', ort: 'A' }, { name: 'X', x: 5000, y: 5 }] }, orte, bild)).toThrow(/außerhalb/);
  });
});

describe('Route: Karte', () => {
  it('schneidet innerhalb der Weltkarte aus und hält das Seitenverhältnis', () => {
    const p = erzeugeRoute(liesRoute(route), orte, bild, 1.3);
    expect(p.ausschnitt.x).toBeGreaterThanOrEqual(0);
    expect(p.ausschnitt.y).toBeGreaterThanOrEqual(0);
    expect(p.ausschnitt.x + p.ausschnitt.w).toBeLessThanOrEqual(2048 + 1e-6);
    expect(p.ausschnitt.y + p.ausschnitt.h).toBeLessThanOrEqual(1536 + 1e-6);
    expect(p.ausschnitt.w / p.ausschnitt.h).toBeCloseTo(1.3, 3);
    for (const s of p.stationen) {
      expect(s.p.x).toBeGreaterThanOrEqual(p.ausschnitt.x);
      expect(s.p.x).toBeLessThanOrEqual(p.ausschnitt.x + p.ausschnitt.w);
    }
    expect(p.km).toBeGreaterThan(1000);
  });
  it('nummeriert Stationen ohne Zwischenpunkte und ist deterministisch', () => {
    const k = routeDateiAlsKarte(route, orte, bild);
    expect(k.marken.map(m => [m.nr, m.name])).toEqual([[1, 'A'], [2, 'B'], [3, 'C']]);
    expect(k.svg).toContain('<image');
    expect(routeDateiAlsKarte(route, orte, bild)).toEqual(k);
    for (const m of k.marken) {
      expect(m.x).toBeGreaterThan(0);
      expect(m.x).toBeLessThan(k.breite);
    }
  });
});
