import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { bildAufbereiten } from './aufbereiten';
import { BildFehler, bildErzeugen, VORBILD_HINWEIS } from './gemini';
import { wunschlisteLesen } from './liste';

const quadrat = (seite: number) =>
  sharp({ create: { width: seite, height: seite, channels: 3, background: { r: 120, g: 90, b: 60 } } }).png().toBuffer();

const LISTE = `# Wunschliste

## Personen

### [ ] Hedda Brand
- Datei: \`personen/hedda-brand.webp\` · Art: person · Name: Hedda Brand
- Stichworte: zöllnerin

\`\`\`text
portrait of a customs officer
\`\`\`

### [x] Schon fertig
- Datei: \`personen/fertig.webp\` · Art: person

\`\`\`text
egal
\`\`\`

### [ ] Freistatt
- Datei: \`orte/freistatt.webp\` · Art: ort · Name: Freistatt

\`\`\`text
an orc harbor town
\`\`\`

### [ ] Ohne Prompt
- Datei: \`orte/leer.webp\` · Art: ort
`;

describe('wunschlisteLesen', () => {
  it('liest offene Einträge mit Format nach Art und meldet unvollständige', () => {
    const { wuensche, unvollstaendig } = wunschlisteLesen(LISTE);
    expect(wuensche).toEqual([
      { titel: 'Hedda Brand', datei: 'personen/hedda-brand.webp', art: 'person', format: '4:5', prompt: 'portrait of a customs officer' },
      { titel: 'Freistatt', datei: 'orte/freistatt.webp', art: 'ort', format: '3:2', prompt: 'an orc harbor town' },
    ]);
    expect(unvollstaendig).toEqual(['Ohne Prompt']);
  });
});

describe('bildAufbereiten', () => {
  it('schneidet mittig auf das Seitenverhältnis zu und speichert WebP', async () => {
    const bild = await bildAufbereiten(await quadrat(1000), '3:2');
    expect([bild.breite, bild.hoehe]).toEqual([1000, 667]);
    const meta = await sharp(bild.daten).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 1000, 667]);
  });

  it('verkleinert auf die größte Breite', async () => {
    const bild = await bildAufbereiten(await quadrat(2000), '4:5', 800);
    expect([bild.breite, bild.hoehe]).toEqual([800, 1000]);
  });
});

describe('bildErzeugen', () => {
  const antwortMitBild = async () =>
    new Response(JSON.stringify({ steps: [{ type: 'model_output', content: [{ type: 'image', data: (await quadrat(1200)).toString('base64') }] }] }));

  it('schickt Prompt, Vorbilder und Format und weicht auf ein Ersatzformat aus', async () => {
    const anfragen: { body: string }[] = [];
    const holen = (async (_url: string, init: RequestInit) => {
      anfragen.push({ body: String(init.body) });
      if (anfragen.length === 1) return new Response('unsupported aspect_ratio', { status: 400 });
      return antwortMitBild();
    }) as typeof fetch;
    const bild = await bildErzeugen({
      key: 'k',
      prompt: 'a harbor',
      format: '4:5',
      vorbilder: [{ daten: new Uint8Array([1, 2, 3]), mime: 'image/jpeg' }],
      holen,
    });
    expect(bild.verhaeltnis).toBe('3:4');
    expect([bild.breite, bild.hoehe]).toEqual([960, 1200]);
    const zweite = JSON.parse(anfragen[1]?.body ?? '{}');
    expect(zweite.response_format).toEqual({ type: 'image', aspect_ratio: '3:4', image_size: '1K' });
    expect(zweite.input[0]).toEqual({ type: 'text', text: VORBILD_HINWEIS + 'a harbor' });
    expect(zweite.input[1]).toEqual({ type: 'image', mime_type: 'image/jpeg', data: 'AQID' });
  });

  it('versucht es bei Überlastung erneut', async () => {
    let n = 0;
    const holen = (async () => (++n === 1 ? new Response('busy', { status: 503 }) : antwortMitBild())) as typeof fetch;
    const bild = await bildErzeugen({ key: 'k', prompt: 'x', format: '3:2', holen, warten: async () => {} });
    expect(n).toBe(2);
    expect(bild.verhaeltnis).toBe('3:2');
  });

  it('gibt bei gesperrtem Modell sofort auf', async () => {
    let n = 0;
    const holen = (async () => {
      n++;
      return new Response('{"error":{"message":"Rate limit exceeded (limit: 0 requests per day on Free Tier)"}}', { status: 429 });
    }) as typeof fetch;
    const fehler = await bildErzeugen({ key: 'k', prompt: 'x', format: '3:2', holen, warten: async () => {} }).catch(e => e);
    expect(fehler).toBeInstanceOf(BildFehler);
    expect(fehler.endgueltig).toBe(true);
    expect(n).toBe(1);
  });

  it('meldet andere Fehler und Antworten ohne Bild', async () => {
    const verboten = (async () => new Response('no billing', { status: 403 })) as typeof fetch;
    await expect(bildErzeugen({ key: 'k', prompt: 'x', format: '3:2', holen: verboten })).rejects.toThrow(BildFehler);
    const leer = (async () => new Response(JSON.stringify({ steps: [] }))) as typeof fetch;
    await expect(bildErzeugen({ key: 'k', prompt: 'x', format: '3:2', holen: leer })).rejects.toThrow('Kein Bild');
  });
});
