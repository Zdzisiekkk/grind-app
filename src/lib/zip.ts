/**
 * Najprostszy możliwy plik ZIP - bez kompresji, bez zależności.
 *
 * Po co własny zamiast biblioteki: eksport danych składa się w przeglądarce
 * (zdjęcia nie przechodzą przez nasz serwer, a funkcja na Vercelu i tak nie
 * oddałaby więcej niż kilka megabajtów), a jedyne, czego trzeba, to zapisać
 * kilka plików jeden za drugim. Metoda "store" wystarcza w pełni: zdjęcia to
 * JPEG-i, których i tak nie da się już ścisnąć, a JSON z danymi to ułamek
 * całości.
 *
 * Format według APPNOTE PKWARE: nagłówek lokalny + dane dla każdego pliku,
 * potem katalog centralny i rekord końcowy. Bez ZIP64, więc do 4 GB -
 * o kilka rzędów wielkości więcej niż ma ktokolwiek.
 */

export type PlikZip = { nazwa: string; dane: Uint8Array; data?: Date };

let tablicaCrc: Uint32Array | null = null;

function crc32(dane: Uint8Array): number {
  if (!tablicaCrc) {
    tablicaCrc = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tablicaCrc[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < dane.length; i++) crc = tablicaCrc[(crc ^ dane[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Data i czas w formacie MS-DOS - tak ZIP zapisuje moment modyfikacji. */
function czasDos(d: Date): { czas: number; data: number } {
  return {
    czas: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    data: (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** Bit 11 flag: nazwy plików w UTF-8 - bez niego "Wygląd" rozsypuje się na Windowsie. */
const FLAGA_UTF8 = 0x0800;

export function zbudujZip(pliki: PlikZip[]): Uint8Array {
  const koder = new TextEncoder();
  const wpisy = pliki.map((p) => {
    const nazwa = koder.encode(p.nazwa);
    return { ...p, nazwaB: nazwa, crc: crc32(p.dane), ...czasDos(p.data ?? new Date()) };
  });

  const rozmiarLokalnych = wpisy.reduce((a, w) => a + 30 + w.nazwaB.length + w.dane.length, 0);
  const rozmiarKatalogu = wpisy.reduce((a, w) => a + 46 + w.nazwaB.length, 0);
  const wynik = new Uint8Array(rozmiarLokalnych + rozmiarKatalogu + 22);
  const v = new DataView(wynik.buffer);

  let o = 0;
  const przesuniecia: number[] = [];

  for (const w of wpisy) {
    przesuniecia.push(o);
    v.setUint32(o, 0x04034b50, true);
    v.setUint16(o + 4, 20, true);
    v.setUint16(o + 6, FLAGA_UTF8, true);
    v.setUint16(o + 8, 0, true); // store
    v.setUint16(o + 10, w.czas, true);
    v.setUint16(o + 12, w.data, true);
    v.setUint32(o + 14, w.crc, true);
    v.setUint32(o + 18, w.dane.length, true);
    v.setUint32(o + 22, w.dane.length, true);
    v.setUint16(o + 26, w.nazwaB.length, true);
    v.setUint16(o + 28, 0, true);
    wynik.set(w.nazwaB, o + 30);
    wynik.set(w.dane, o + 30 + w.nazwaB.length);
    o += 30 + w.nazwaB.length + w.dane.length;
  }

  const startKatalogu = o;
  wpisy.forEach((w, i) => {
    v.setUint32(o, 0x02014b50, true);
    v.setUint16(o + 4, 20, true);
    v.setUint16(o + 6, 20, true);
    v.setUint16(o + 8, FLAGA_UTF8, true);
    v.setUint16(o + 10, 0, true);
    v.setUint16(o + 12, w.czas, true);
    v.setUint16(o + 14, w.data, true);
    v.setUint32(o + 16, w.crc, true);
    v.setUint32(o + 20, w.dane.length, true);
    v.setUint32(o + 24, w.dane.length, true);
    v.setUint16(o + 28, w.nazwaB.length, true);
    v.setUint16(o + 30, 0, true);
    v.setUint16(o + 32, 0, true);
    v.setUint16(o + 34, 0, true);
    v.setUint16(o + 36, 0, true);
    v.setUint32(o + 38, 0, true);
    v.setUint32(o + 42, przesuniecia[i], true);
    wynik.set(w.nazwaB, o + 46);
    o += 46 + w.nazwaB.length;
  });

  v.setUint32(o, 0x06054b50, true);
  v.setUint16(o + 4, 0, true);
  v.setUint16(o + 6, 0, true);
  v.setUint16(o + 8, wpisy.length, true);
  v.setUint16(o + 10, wpisy.length, true);
  v.setUint32(o + 12, o - startKatalogu, true);
  v.setUint32(o + 16, startKatalogu, true);
  v.setUint16(o + 20, 0, true);

  return wynik;
}
