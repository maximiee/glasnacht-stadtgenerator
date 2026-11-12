/** Ein Bildwunsch aus einer Markdown-Liste im Format der Glasnacht-Wunschliste. */
export interface BildWunsch {
  titel: string;
  /** Pfad ab dem Bilderordner, z. B. `personen/hedda-brand.webp` */
  datei: string;
  art: string;
  /** Seitenverhältnis: Personen hoch, alles andere quer */
  format: Seitenverhaeltnis;
  prompt: string;
}

export type Seitenverhaeltnis = '4:5' | '3:2' | '3:4' | '4:3' | '1:1' | '5:4' | '2:3' | '16:9' | '9:16';

/**
 * Liest die offenen Einträge (`### [ ] Titel`) einer Wunschliste. Ein Eintrag braucht die Zeile
 * „- Datei: `pfad` · Art: art“ und den Prompt in einem ```text-Block; abgehakte (`[x]`) fallen weg.
 */
export function wunschlisteLesen(text: string): { wuensche: BildWunsch[]; unvollstaendig: string[] } {
  const wuensche: BildWunsch[] = [];
  const unvollstaendig: string[] = [];
  for (const teil of text.split(/^(?=### )/m)) {
    if (!teil.startsWith('### [ ] ')) continue;
    const titel = (teil.split('\n')[0] ?? '').slice('### [ ] '.length).trim();
    const datei = /- Datei: `(.+?)` · Art: (\w+)/.exec(teil);
    const prompt = /```text\n([\s\S]+?)\n```/.exec(teil);
    if (!datei?.[1] || !datei[2] || !prompt?.[1]) {
      unvollstaendig.push(titel);
      continue;
    }
    const art = datei[2];
    wuensche.push({ titel, datei: datei[1], art, format: art === 'person' ? '4:5' : '3:2', prompt: prompt[1].trim() });
  }
  return { wuensche, unvollstaendig };
}
