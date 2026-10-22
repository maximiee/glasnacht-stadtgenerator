import { readFileSync, writeFileSync } from 'node:fs';
import { stadtDateiAlsSvg } from './index';

const [eingabe, ausgabe] = process.argv.slice(2);
if (!eingabe || !ausgabe) {
  console.error('Aufruf: npm run svg -- <stadt.json> <ausgabe.svg>');
  process.exit(1);
}
writeFileSync(ausgabe, stadtDateiAlsSvg(readFileSync(eingabe, 'utf8')));
console.log(`${ausgabe} geschrieben`);
