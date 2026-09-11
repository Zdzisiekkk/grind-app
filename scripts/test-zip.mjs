/*
 * Eksport danych jako ZIP (src/lib/zip.ts).
 *
 * Plik, którego nie da się otworzyć, jest gorszy niż brak eksportu: człowiek
 * myśli, że ma kopię, a ma śmieci. Dlatego archiwum czyta niezależny czytnik
 * - `zipfile` z Pythona, który sprawdza sumy kontrolne każdego pliku - a nie
 * nasz własny odczyt, który zgadzałby się z naszym własnym błędem.
 *
 * Nie `unzip`: wersja wbudowana w macOS nie obsługuje flagi UTF-8 i na
 * "zęby.jpg" zgłasza "disk full" - błąd czytnika, nie archiwum.
 *
 * Uruchom: npm run test:zip
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zbudujZip } from '../src/lib/zip.ts';

let ok = 0, bad = 0;
const check = (n, c, d = '') => {
  if (c) { ok++; console.log(`  ✅ ${n}`); }
  else { bad++; console.log(`  ❌ ${n}${d ? ' - ' + d : ''}`); }
};

const enc = new TextEncoder();
const json = enc.encode(JSON.stringify({ aplikacja: 'Grind', dane: { wpisy: [1, 2, 3] } }, null, 2));
// Bajty spoza ASCII i zera - JPEG to nie tekst.
const obraz = new Uint8Array(70_000).map((_, i) => (i * 131 + 7) % 256);
const sha = (b) => createHash('sha256').update(b).digest('hex');

const zip = zbudujZip([
  { nazwa: 'README.txt', dane: enc.encode('Kopia danych.\n') },
  { nazwa: 'dane.json', dane: json },
  { nazwa: 'wyglad/2026-09-10_abcd1234/front.jpg', dane: obraz },
  { nazwa: 'wyglad/2026-09-10_abcd1234/zęby.jpg', dane: obraz.slice(0, 10) },
]);

const CZYTNIK = `
import hashlib, json, sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
print(json.dumps({
  "uszkodzony": z.testzip(),
  "nazwy": z.namelist(),
  "front": hashlib.sha256(z.read("wyglad/2026-09-10_abcd1234/front.jpg")).hexdigest(),
  "dane": json.loads(z.read("dane.json")),
}))
`;

const katalog = mkdtempSync(join(tmpdir(), 'grind-zip-'));
const plik = join(katalog, 'kopia.zip');
writeFileSync(plik, zip);

try {
  const wynik = JSON.parse(execFileSync('python3', ['-c', CZYTNIK, plik], { encoding: 'utf8' }));
  check('sumy kontrolne wszystkich plików się zgadzają', wynik.uszkodzony === null, String(wynik.uszkodzony));
  check('są wszystkie cztery pliki', wynik.nazwy.length === 4, wynik.nazwy.join(', '));
  check('polskie znaki w nazwie przetrwały', wynik.nazwy.includes('wyglad/2026-09-10_abcd1234/zęby.jpg'),
    wynik.nazwy.join(', '));
  check('zdjęcie wraca bajt w bajt', wynik.front === sha(obraz));
  check('JSON wraca i daje się odczytać', wynik.dane.aplikacja === 'Grind' && wynik.dane.dane.wpisy.length === 3);
} catch (e) {
  check('czytnik ZIP otwiera archiwum', false, e.message);
} finally {
  rmSync(katalog, { recursive: true, force: true });
}

check('pusty eksport to nadal poprawny ZIP (sam rekord końcowy)', zbudujZip([]).length === 22);

console.log(`\n  zielonych: ${ok}${bad ? `, CZERWONYCH: ${bad}` : ' - WSZYSTKO PRZESZŁO'}\n`);
process.exit(bad ? 1 : 0);
