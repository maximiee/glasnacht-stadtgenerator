import { describe, expect, it } from 'vitest';
import { erzeugeGebaeude, gebaeudeDateiAlsKarte, liesGebaeude, type RaumArt } from './index';

const arten: RaumArt[] = ['wohnraum', 'schlafraum', 'kueche', 'vorrat', 'werkstatt', 'schankraum', 'laden', 'lager', 'flur', 'halle', 'altar', 'kammer', 'stall', 'bad', 'keller', 'saal', 'wachraum', 'zelle', 'raum'];

const haus = (seed: string, etagen = 2) => ({
  version: 1,
  name: 'Probehaus',
  seed,
  etagen: Array.from({ length: etagen }, (_, e) => ({
    raeume: [
      { name: `Stube ${e}`, art: 'wohnraum', flaeche: 24 },
      { name: `Küche ${e}`, art: 'kueche', flaeche: 14 },
      { name: `Kammer ${e}`, art: 'kammer', flaeche: 9 },
      { name: `Schlaf ${e}`, art: 'schlafraum', flaeche: 12, kurz: 'Betten.' },
    ],
  })),
});

describe('Gebäude: Eingabe', () => {
  it('nimmt `raeume` als eine Etage und meldet Fehler verständlich', () => {
    expect(liesGebaeude({ version: 1, name: 'H', raeume: [{ name: 'A' }] }).etagen).toHaveLength(1);
    expect(() => liesGebaeude({ version: 1, name: 'H' })).toThrow(/etagen/);
    expect(() => liesGebaeude({ version: 1, name: 'H', raeume: [{ name: 'A', art: 'thron' }] })).toThrow(/art/);
    expect(() => liesGebaeude({ version: 1, name: 'H', raeume: [{ name: 'A' }, { name: 'A' }] })).toThrow(/doppelt/);
    expect(() => liesGebaeude({ version: 1, name: 'H', raeume: [{ name: 'A', flaeche: 1 }] })).toThrow(/flaeche/);
  });
});

describe('Gebäude: Grundriss', () => {
  it('ist bei gleichem Seed gleich und füllt die Grundfläche ohne Überlappung', () => {
    const a = erzeugeGebaeude(liesGebaeude(haus('s1')));
    const b = erzeugeGebaeude(liesGebaeude(haus('s1')));
    expect(a).toEqual(b);
    for (const e of a.etagen) {
      const summe = e.raeume.reduce((s, r) => s + r.r.w * r.r.h, 0);
      expect(summe).toBeCloseTo(a.breite * a.tiefe, 3);
      for (const [i, p] of e.raeume.entries()) for (const q of e.raeume.slice(i + 1)) {
        const ueber = p.r.x < q.r.x + q.r.w - 1e-6 && p.r.x + p.r.w > q.r.x + 1e-6 && p.r.y < q.r.y + q.r.h - 1e-6 && p.r.y + p.r.h > q.r.y + 1e-6;
        expect(ueber).toBe(false);
      }
    }
  });

  it('verbindet alle Räume über Türen mit dem Eingang, in jeder Etage und für viele Seeds', () => {
    for (let n = 0; n < 40; n++) {
      const plan = erzeugeGebaeude(liesGebaeude(haus(`seed${n}`, 1 + (n % 3))));
      plan.etagen.forEach((e, ei) => {
        const start = ei === 0 ? e.tueren.find(t => t.aussen)?.von : 0;
        if (ei === 0) expect(start).toBeDefined();
        const erreicht = new Set<number>([start ?? 0]);
        let wachsen = true;
        while (wachsen) {
          wachsen = false;
          for (const t of e.tueren) if (!t.aussen && erreicht.has(t.von) !== erreicht.has(t.nach)) { erreicht.add(t.von); erreicht.add(t.nach); wachsen = true; }
        }
        expect(erreicht.size).toBe(e.raeume.length);
      });
    }
  });

  it('legt Türen auf gemeinsame Wände und Fenster auf Außenwände', () => {
    const plan = erzeugeGebaeude(liesGebaeude(haus('wand')));
    for (const e of plan.etagen) {
      for (const t of e.tueren.filter(t => !t.aussen)) {
        const p = e.raeume[t.von]!.r;
        const q = e.raeume[t.nach]!.r;
        const auf = (r: typeof p) => (t.waagerecht ? [r.y, r.y + r.h].some(y => Math.abs(y - t.y) < 1e-6) && t.x >= r.x && t.x <= r.x + r.w : [r.x, r.x + r.w].some(x => Math.abs(x - t.x) < 1e-6) && t.y >= r.y && t.y <= r.y + r.h);
        expect(auf(p) && auf(q)).toBe(true);
      }
      for (const fe of e.fenster) {
        const aussen = fe.waagerecht ? [0, plan.tiefe].some(y => Math.abs(y - fe.y) < 1e-6) : [0, plan.breite].some(x => Math.abs(x - fe.x) < 1e-6);
        expect(aussen).toBe(true);
      }
    }
  });

  it('hat in jeder Etage dasselbe Treppenhaus an derselben Stelle', () => {
    const plan = erzeugeGebaeude(liesGebaeude(haus('treppe', 3)));
    const rects = plan.etagen.map(e => e.raeume.find(r => r.treppenhaus)?.r);
    expect(rects.every(r => r && r.x === 0 && r.y === 0 && r.h === plan.tiefe)).toBe(true);
  });
});

describe('Gebäude: Karte', () => {
  it('zeichnet jede Raumart und liefert fortlaufend nummerierte Marken mit Kurztext', () => {
    const k = gebaeudeDateiAlsKarte({ version: 1, name: 'Alles', seed: 'x', etagen: [{ raeume: arten.slice(0, 10).map(a => ({ name: a, art: a })) }, { raeume: arten.slice(10).map(a => ({ name: a, art: a })) }] });
    expect(k.svg).toContain('<svg');
    expect(k.marken.map(m => m.nr)).toEqual(k.marken.map((_, i) => i + 1));
    expect(k.marken.length).toBe(arten.length + 2); // zwei Treppenhäuser
    for (const m of k.marken) { expect(m.x).toBeGreaterThan(0); expect(m.x).toBeLessThan(k.breite); expect(m.y).toBeGreaterThan(0); expect(m.y).toBeLessThan(k.hoehe); }
    const g = gebaeudeDateiAlsKarte(haus('kurz', 1));
    expect(g.marken.find(m => m.name === 'Schlaf 0')?.kurz).toBe('Betten.');
  });
});
