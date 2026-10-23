import { readFileSync, writeFileSync } from 'node:fs';
import { gebaeudeDateiAlsKarte, istGebaeude, stadtDateiAlsSvg } from './index';

const [eingabe, ausgabe] = process.argv.slice(2);
if (!eingabe || !ausgabe) {
  console.error('Aufruf: npm run svg -- <stadt.json> <ausgabe.svg>');
  process.exit(1);
}
const text = readFileSync(eingabe, 'utf8');
writeFileSync(ausgabe, istGebaeude(JSON.parse(text)) ? gebaeudeDateiAlsKarte(text).svg : stadtDateiAlsSvg(text));
console.log(`${ausgabe} geschrieben`);
