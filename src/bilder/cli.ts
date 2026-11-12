import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { BildFehler, bildErzeugen, GEMINI_MODELL } from './gemini';
import { wunschlisteLesen } from './liste';

const PREIS_JE_BILD = 0.034; // US-Dollar, Nano Banana 2.1 in 1K (Stand 12.11.2026)

const HILFE = `Aufruf: npm run bilder -- <liste.md> <ausgabeordner> [Optionen]

  --vorbild <datei>   Stilvorbild, mehrfach möglich (JPEG, PNG, WebP)
  --fertig <ordner>   Wünsche überspringen, deren Datei dort schon liegt (z. B. der Bilderordner)
  --nur <n>           höchstens n Bilder
  --eintrag <text>    nur Einträge, deren Überschrift den Text enthält
  --neu               vorhandene Bilder im Ausgabeordner ersetzen
  --trocken           nur anzeigen, nichts senden (kostet nichts)
  --env <datei>       Schlüssel aus einer .env-Datei lesen (Zeile GEMINI_API_KEY=…)

Der Schlüssel kommt sonst aus der Umgebungsvariable GEMINI_API_KEY.`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    vorbild: { type: 'string', multiple: true },
    fertig: { type: 'string' },
    nur: { type: 'string' },
    eintrag: { type: 'string' },
    neu: { type: 'boolean' },
    trocken: { type: 'boolean' },
    env: { type: 'string' },
  },
});

const [listePfad, ausgabe] = positionals;
if (!listePfad || !ausgabe) {
  console.error(HILFE);
  process.exit(1);
}

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function schluessel(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  if (values.env && existsSync(values.env)) {
    const zeile = readFileSync(values.env, 'utf8').split('\n').find(z => z.startsWith('GEMINI_API_KEY='));
    if (zeile) return zeile.slice('GEMINI_API_KEY='.length).trim();
  }
  console.error('Kein Schlüssel: GEMINI_API_KEY setzen oder mit --env eine .env-Datei angeben.');
  process.exit(1);
}

const { wuensche, unvollstaendig } = wunschlisteLesen(readFileSync(listePfad, 'utf8'));
for (const t of unvollstaendig) console.warn(`Übersprungen (unvollständig): ${t}`);

let offen = wuensche.filter(w => {
  if (values.eintrag && !w.titel.toLowerCase().includes(values.eintrag.toLowerCase())) return false;
  if (values.fertig && existsSync(join(values.fertig, w.datei))) return false;
  return values.neu || !existsSync(join(ausgabe, w.datei));
});
if (values.nur) offen = offen.slice(0, Number(values.nur));
if (!offen.length) {
  console.log('Nichts zu tun.');
  process.exit(0);
}

console.log(`${offen.length} Bild(er), Modell ${GEMINI_MODELL}, ca. ${(offen.length * PREIS_JE_BILD).toFixed(2)} $`);
if (values.trocken) {
  for (const w of offen) console.log(`- ${w.titel} → ${join(ausgabe, w.datei)} (${w.format})`);
  process.exit(0);
}

const key = schluessel();
const vorbilder = (values.vorbild ?? []).map(pfad => {
  const mime = MIME[extname(pfad).toLowerCase()];
  if (!mime) throw new Error(`Vorbild ${pfad}: nur JPEG, PNG oder WebP`);
  return { daten: readFileSync(pfad), mime };
});

let fertig = 0;
for (const [i, w] of offen.entries()) {
  const ziel = join(ausgabe, w.datei);
  console.log(`[${i + 1}/${offen.length}] ${w.titel} → ${ziel}`);
  try {
    const bild = await bildErzeugen({ key, prompt: w.prompt, format: w.format, vorbilder, melden: t => console.log(`  ${t}`) });
    mkdirSync(dirname(ziel), { recursive: true });
    writeFileSync(ziel, bild.daten);
    fertig++;
  } catch (e) {
    console.error(`  ${e instanceof Error ? e.message : String(e)}`);
    if (e instanceof BildFehler && e.endgueltig) {
      console.error('Abgebrochen, die übrigen Bilder würden genauso scheitern.');
      break;
    }
  }
}
console.log(`Fertig: ${fertig} von ${offen.length} in ${ausgabe}`);
