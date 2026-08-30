/**
 * Generuje ikony PWA bez żadnych zewnętrznych zależności.
 * Rysuje piktogram hantla na pikselowej mapie i zapisuje ją jako PNG
 * (kompresja zlib i CRC32 są w standardowej bibliotece Node).
 *
 * Uruchomienie:  npm run icons
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

const BG = [10, 12, 16, 255];        // #0a0c10 - tło zgodne z ciemnym motywem
const FG = [242, 96, 12, 255];       // #f2600c - pomarańcz marki
const FG_DIM = [255, 122, 51, 255];  // #ff7a33 - jaśniejszy akcent na kołnierze

/* --------------------------- Minimalny koder PNG --------------------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // 8 bitów na kanał
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // filtr adaptacyjny
  ihdr[12] = 0; // bez przeplotu

  // Każdy wiersz poprzedzony bajtem filtru 0 (brak filtrowania)
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ------------------------------ Rysowanie ---------------------------------- */

function makeIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = color[0];
    px[i + 1] = color[1];
    px[i + 2] = color[2];
    px[i + 3] = color[3];
  };

  const u = size / 100; // jednostka: procent boku ikony
  const radius = 22 * u;

  // Tło z zaokrąglonymi rogami
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.max(radius - x, x - (size - radius), 0);
      const dy = Math.max(radius - y, y - (size - radius), 0);
      if (dx * dx + dy * dy <= radius * radius) set(x, y, BG);
    }
  }

  const rect = (x0, y0, w, h, color) => {
    for (let y = Math.round(y0); y < Math.round(y0 + h); y++) {
      for (let x = Math.round(x0); x < Math.round(x0 + w); x++) set(x, y, color);
    }
  };

  // Hantel: gryf + po dwa talerze z każdej strony
  const midY = 50 * u;
  rect(30 * u, midY - 4 * u, 40 * u, 8 * u, FG);              // gryf
  rect(22 * u, midY - 16 * u, 9 * u, 32 * u, FG);             // duży talerz lewy
  rect(69 * u, midY - 16 * u, 9 * u, 32 * u, FG);             // duży talerz prawy
  rect(14 * u, midY - 10 * u, 7 * u, 20 * u, FG_DIM);         // mały talerz lewy
  rect(79 * u, midY - 10 * u, 7 * u, 20 * u, FG_DIM);         // mały talerz prawy

  return encodePng(size, size, px);
}

mkdirSync(OUT_DIR, { recursive: true });

for (const size of [180, 192, 512]) {
  const file = path.join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(file, makeIcon(size));
  console.log(`✅ ${path.relative(process.cwd(), file)}`);
}
