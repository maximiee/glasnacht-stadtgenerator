import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
  it('liefert bei gleichem Seed dieselbe Folge', () => {
    const a = createRng('Thalassa');
    const b = createRng('Thalassa');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('liefert Werte im Bereich [0, 1)', () => {
    const r = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
