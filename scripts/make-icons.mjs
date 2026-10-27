// Generates the PWA icons into public/ with no dependencies (hand-rolled PNG encoder).
// Run: npm run icons
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const BG = [0x0e, 0x7c, 0x66];
const FG = [0xff, 0xff, 0xff];

// Shape in unit coordinates (0..1). Returns 'fg' | 'bg' | null (transparent).
function shape(x, y, rounded) {
  if (rounded) {
    const r = 0.22, cx = Math.min(Math.max(x, r), 1 - r), cy = Math.min(Math.max(y, r), 1 - r);
    if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) return null;
  }
  // Roof: triangle apex (0.5, 0.2), base y=0.48 from x=0.18..0.82
  const inRoof = y >= 0.2 && y <= 0.48 && Math.abs(x - 0.5) <= ((y - 0.2) / 0.28) * 0.32;
  // Body: 0.28..0.72 × 0.46..0.8
  const inBody = x >= 0.28 && x <= 0.72 && y >= 0.46 && y <= 0.8;
  // Door cut-out
  const inDoor = x >= 0.44 && x <= 0.56 && y >= 0.6 && y <= 0.8;
  return (inRoof || inBody) && !inDoor ? 'fg' : 'bg';
}

function render(size, rounded) {
  const SS = 4;
  const px = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const s = shape((i + (sx + 0.5) / SS) / size, (j + (sy + 0.5) / SS) / size, rounded);
        if (!s) continue;
        const c = s === 'fg' ? FG : BG;
        r += c[0]; g += c[1]; b += c[2]; a += 1;
      }
      const o = (j * size + i) * 4;
      if (a) { px[o] = r / a; px[o + 1] = g / a; px[o + 2] = b / a; }
      px[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return px;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUT, { recursive: true });
// Full-bleed squares for the manifest (maskable-safe) and iOS (which rounds itself);
// rounded for the browser favicon.
for (const [name, size, rounded] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['apple-touch-icon.png', 180, false],
  ['favicon.png', 64, true],
]) {
  fs.writeFileSync(path.join(OUT, name), png(size, render(size, rounded)));
  console.log('wrote', name);
}
