import { bildAufbereiten, type FertigesBild } from './aufbereiten';
import type { Seitenverhaeltnis } from './liste';

export const GEMINI_MODELL = 'gemini-nano-banana-2.1';
const ADRESSE = 'https://generativelanguage.googleapis.com/v1beta/interactions';

/** Steht vor dem Prompt, wenn Vorbilder mitgehen: nur den Malstil übernehmen. */
export const VORBILD_HINWEIS =
  'The attached images are style references only: copy their painting technique, brushwork, ' +
  'level of detail, colors and lighting, but none of their people, buildings, objects or composition. ' +
  'Paint this new picture: ';

/** Lehnt das Modell ein Seitenverhältnis ab, wird mit dem nächstliegenden erzeugt und danach zugeschnitten. */
const ERSATZ: Partial<Record<Seitenverhaeltnis, Seitenverhaeltnis>> = { '4:5': '3:4', '3:2': '4:3', '5:4': '4:3', '2:3': '3:4' };

export interface Vorbild {
  daten: Uint8Array;
  mime: string;
}

export interface BildAuftrag {
  key: string;
  prompt: string;
  format: Seitenverhaeltnis;
  vorbilder?: Vorbild[];
  /** Steht vor dem Prompt, wenn Vorbilder mitgehen; Standard `VORBILD_HINWEIS`. Leer, wenn der Prompt die Bilder selbst erklärt. */
  vorbildHinweis?: string;
  modell?: string;
  /** `1K`, `2K` oder `4K` */
  groesse?: '1K' | '2K' | '4K';
  maxBreite?: number;
  /** zum Testen hereinreichen, sonst das globale `fetch` */
  holen?: typeof fetch;
  /** Wartezeit vor einem neuen Versuch nach 429/5xx, Standard 20 s × Versuch */
  warten?: (ms: number) => Promise<void>;
  /** Meldungen unterwegs (Ersatzformat, neuer Versuch) */
  melden?: (text: string) => void;
}

export class BildFehler extends Error {
  /** `endgueltig`: weitere Versuche mit diesem Schlüssel sind zwecklos */
  constructor(meldung: string, readonly endgueltig = false) {
    super(meldung);
  }
}

/** Erzeugt ein Bild über die Gemini-API und gibt es als WebP im gewünschten Format zurück. */
export async function bildErzeugen(a: BildAuftrag): Promise<FertigesBild & { verhaeltnis: Seitenverhaeltnis }> {
  const holen = a.holen ?? fetch;
  const warten = a.warten ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)));
  const melden = a.melden ?? (() => {});
  const vorbilder = a.vorbilder ?? [];
  let verhaeltnis = a.format;
  for (let versuch = 0; versuch < 4; versuch++) {
    const antwort = await holen(ADRESSE, {
      method: 'POST',
      headers: { 'x-goog-api-key': a.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: a.modell ?? GEMINI_MODELL,
        input: [
          { type: 'text', text: (vorbilder.length ? (a.vorbildHinweis ?? VORBILD_HINWEIS) : '') + a.prompt },
          ...vorbilder.map(v => ({ type: 'image', mime_type: v.mime, data: Buffer.from(v.daten).toString('base64') })),
        ],
        response_format: { type: 'image', aspect_ratio: verhaeltnis, image_size: a.groesse ?? '1K' },
      }),
    });
    if (!antwort.ok) {
      const text = await antwort.text();
      const ersatz = ERSATZ[verhaeltnis];
      if (antwort.status === 400 && /aspect/i.test(text) && ersatz) {
        melden(`Seitenverhältnis ${verhaeltnis} abgelehnt, nehme ${ersatz} und schneide zu`);
        verhaeltnis = ersatz;
        continue;
      }
      // „limit: 0“ heißt: Das Modell ist für diesen Schlüssel gesperrt (z. B. kostenlose Stufe), Warten hilft nicht.
      if (antwort.status === 429 && /limit: 0\b/.test(text)) {
        throw new BildFehler(`Gemini: Modell für diesen Schlüssel gesperrt (Abrechnung nötig): ${text.slice(0, 300)}`, true);
      }
      if ([429, 500, 502, 503, 504].includes(antwort.status) && versuch < 3) {
        melden(`HTTP ${antwort.status}, neuer Versuch`);
        await warten(20_000 * (versuch + 1));
        continue;
      }
      throw new BildFehler(`Gemini antwortet mit HTTP ${antwort.status}: ${text.slice(0, 500)}`);
    }
    const json: unknown = await antwort.json();
    const daten = bildFinden(json);
    if (!daten) throw new BildFehler(`Kein Bild in der Antwort: ${JSON.stringify(json).slice(0, 500)}`);
    const bild = await bildAufbereiten(Buffer.from(daten, 'base64'), a.format, a.maxBreite);
    return { ...bild, verhaeltnis };
  }
  throw new BildFehler('Gemini: zu viele Versuche');
}

/** Sucht in der Antwort den ersten Block `{ type: 'image', data }` (Base64). */
function bildFinden(knoten: unknown): string | undefined {
  if (Array.isArray(knoten)) {
    for (const k of knoten) {
      const d = bildFinden(k);
      if (d) return d;
    }
  } else if (knoten && typeof knoten === 'object') {
    const o = knoten as Record<string, unknown>;
    if (o.type === 'image' && typeof o.data === 'string') return o.data;
    for (const k of Object.values(o)) {
      const d = bildFinden(k);
      if (d) return d;
    }
  }
  return undefined;
}
