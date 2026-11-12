import sharp from 'sharp';
import type { Seitenverhaeltnis } from './liste';

export interface FertigesBild {
  /** WebP */
  daten: Buffer;
  breite: number;
  hoehe: number;
}

/** Schneidet mittig auf das Seitenverhältnis zu, verkleinert auf höchstens `maxBreite` und speichert als WebP. */
export async function bildAufbereiten(roh: Uint8Array, format: Seitenverhaeltnis, maxBreite = 1280): Promise<FertigesBild> {
  const bild = sharp(roh).rotate();
  const { width = 0, height = 0 } = await bild.metadata();
  if (!width || !height) throw new Error('Bild ohne Größe');
  const [b = 1, h = 1] = format.split(':').map(Number);
  const ziel = b / h;
  let breite = width;
  let hoehe = height;
  if (width / height > ziel) breite = Math.round(height * ziel);
  else hoehe = Math.round(width / ziel);
  const fertigBreite = Math.min(breite, maxBreite);
  const fertigHoehe = Math.round((hoehe * fertigBreite) / breite);
  const daten = await bild
    .extract({ left: Math.floor((width - breite) / 2), top: Math.floor((height - hoehe) / 2), width: breite, height: hoehe })
    .resize(fertigBreite, fertigHoehe)
    .webp({ quality: 88 })
    .toBuffer();
  return { daten, breite: fertigBreite, hoehe: fertigHoehe };
}
