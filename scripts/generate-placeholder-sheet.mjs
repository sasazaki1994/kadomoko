// Generates a placeholder pixel-art sprite sheet for KadoMoco.
// Output: src/assets/pet/pixel/kadomoco_sheet.png (256x512, 4 cols x 8 rows, 64px frames)
// The art is intentionally simple: a round unclassified creature with two
// ambiguous nubs (not ears, not horns), short feet, pale colors.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WIDTH = 256;
const HEIGHT = 512;
const FRAME = 64;
const COLS = 4;

// Pale palette (8 colors incl. transparent).
const C = {
  body: [242, 224, 200, 255],
  shade: [227, 204, 174, 255],
  outline: [138, 122, 110, 255],
  eye: [85, 74, 70, 255],
  mouth: [172, 122, 110, 255],
  blush: [245, 201, 184, 255],
  accent: [176, 196, 222, 255],
};

const pixels = new Uint8Array(WIDTH * HEIGHT * 4);

function setPx(x, y, color) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const i = (y * WIDTH + x) * 4;
  pixels[i] = color[0];
  pixels[i + 1] = color[1];
  pixels[i + 2] = color[2];
  pixels[i + 3] = color[3];
}

function fillEllipse(cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) setPx(x, y, color);
    }
  }
}

function outlineEllipse(cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry) + 1; y++) {
    for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx) + 1; x++) {
      const inside = (px, py) => {
        const dx = (px - cx) / rx;
        const dy = (py - cy) / ry;
        return dx * dx + dy * dy <= 1;
      };
      if (!inside(x, y)) continue;
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) {
        setPx(x, y, color);
      }
    }
  }
}

/**
 * Draws one 64x64 frame.
 * ox/oy: top-left of the frame. pose controls per-row/per-frame details.
 */
function drawFrame(ox, oy, pose) {
  const bob = pose.bob ?? 0;
  const squash = pose.squash ?? 0;
  const cx = ox + 32;
  const bodyCy = oy + 40 + bob + squash;
  const rx = 19 + squash;
  const ry = 15 - squash;

  // Ambiguous nubs on top (could be ears, could be horns).
  const nubY = bodyCy - ry - 3;
  for (const side of [-1, 1]) {
    const nx = cx + side * 9;
    fillEllipse(nx, nubY, 3, 5, C.body);
    outlineEllipse(nx, nubY, 3, 5, C.outline);
    fillEllipse(nx, nubY, 3, 5 - 2, C.body);
  }

  // Short feet.
  for (const side of [-1, 1]) {
    fillEllipse(cx + side * 10, bodyCy + ry - 1, 4, 3, C.shade);
    outlineEllipse(cx + side * 10, bodyCy + ry - 1, 4, 3, C.outline);
  }

  // Body.
  fillEllipse(cx, bodyCy, rx, ry, C.body);
  outlineEllipse(cx, bodyCy, rx, ry, C.outline);
  fillEllipse(cx - 4, bodyCy + 4, rx - 8, ry - 7, C.shade);
  fillEllipse(cx, bodyCy - 2, rx - 4, ry - 4, C.body);

  const eyeY = bodyCy - 3;
  const eyeLX = cx - 7;
  const eyeRX = cx + 7;

  switch (pose.eyes) {
    case 'open':
      for (const ex of [eyeLX, eyeRX]) {
        setPx(ex, eyeY, C.eye);
        setPx(ex, eyeY + 1, C.eye);
        setPx(ex + 1, eyeY, C.eye);
        setPx(ex + 1, eyeY + 1, C.eye);
      }
      break;
    case 'happy':
      for (const ex of [eyeLX, eyeRX]) {
        setPx(ex - 1, eyeY + 1, C.eye);
        setPx(ex, eyeY, C.eye);
        setPx(ex + 1, eyeY, C.eye);
        setPx(ex + 2, eyeY + 1, C.eye);
      }
      break;
    case 'half':
      for (const ex of [eyeLX, eyeRX]) {
        setPx(ex, eyeY + 1, C.eye);
        setPx(ex + 1, eyeY + 1, C.eye);
      }
      break;
    case 'closed':
      for (const ex of [eyeLX, eyeRX]) {
        setPx(ex - 1, eyeY + 1, C.eye);
        setPx(ex, eyeY + 1, C.eye);
        setPx(ex + 1, eyeY + 1, C.eye);
      }
      break;
    case 'wide':
      for (const ex of [eyeLX, eyeRX]) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = 0; dx <= 1; dx++) setPx(ex + dx, eyeY + dy, C.eye);
        }
      }
      break;
    case 'flat':
      for (const ex of [eyeLX, eyeRX]) {
        setPx(ex, eyeY, C.eye);
        setPx(ex + 1, eyeY, C.eye);
      }
      break;
  }

  const mouthY = bodyCy + 3;
  switch (pose.mouth) {
    case 'dot':
      setPx(cx, mouthY, C.mouth);
      break;
    case 'smile':
      setPx(cx - 2, mouthY - 1, C.mouth);
      setPx(cx - 1, mouthY, C.mouth);
      setPx(cx, mouthY, C.mouth);
      setPx(cx + 1, mouthY, C.mouth);
      setPx(cx + 2, mouthY - 1, C.mouth);
      break;
    case 'open':
      fillEllipse(cx, mouthY, 2, 2, C.mouth);
      break;
    case 'frown':
      setPx(cx - 2, mouthY + 1, C.mouth);
      setPx(cx - 1, mouthY, C.mouth);
      setPx(cx, mouthY, C.mouth);
      setPx(cx + 1, mouthY, C.mouth);
      setPx(cx + 2, mouthY + 1, C.mouth);
      break;
    case 'wavy':
      setPx(cx - 2, mouthY, C.mouth);
      setPx(cx - 1, mouthY + 1, C.mouth);
      setPx(cx, mouthY, C.mouth);
      setPx(cx + 1, mouthY + 1, C.mouth);
      setPx(cx + 2, mouthY, C.mouth);
      break;
    case 'none':
      break;
  }

  if (pose.blush) {
    setPx(cx - 12, bodyCy + 1, C.blush);
    setPx(cx - 11, bodyCy + 1, C.blush);
    setPx(cx + 11, bodyCy + 1, C.blush);
    setPx(cx + 12, bodyCy + 1, C.blush);
  }

  // Extra decorations.
  if (pose.zzz) {
    const zx = ox + 46;
    const zy = oy + 14 - (pose.frame % 2);
    for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]]) {
      setPx(zx + dx, zy + dy, C.accent);
    }
  }
  if (pose.sparkle) {
    const sx = ox + 14;
    const sy = oy + 12 + (pose.frame % 2);
    setPx(sx, sy - 1, C.accent);
    setPx(sx, sy + 1, C.accent);
    setPx(sx - 1, sy, C.accent);
    setPx(sx + 1, sy, C.accent);
  }
  if (pose.drop) {
    setPx(ox + 45, oy + 20, C.accent);
    setPx(ox + 45, oy + 21, C.accent);
    setPx(ox + 44, oy + 21, C.accent);
  }
}

// Row definitions: 4 frames each. frame index i in 0..3.
const rows = [
  // row 1: normal — gentle bob, blink on frame 3.
  (i) => ({ eyes: i === 3 ? 'closed' : 'open', mouth: 'dot', bob: i === 1 ? 1 : 0, frame: i }),
  // row 2: happy — smile, blush, bouncy.
  (i) => ({ eyes: 'happy', mouth: 'smile', blush: true, bob: i % 2 === 1 ? -2 : 0, frame: i }),
  // row 3: hungry — flat eyes, open mouth, drooping.
  (i) => ({ eyes: 'flat', mouth: 'open', bob: i % 2, squash: 1, drop: i >= 2, frame: i }),
  // row 4: sleepy — half-closed eyes, slow sway.
  (i) => ({ eyes: i === 2 ? 'closed' : 'half', mouth: 'dot', bob: i === 1 || i === 2 ? 1 : 0, frame: i }),
  // row 5: sleeping — closed eyes, squashed, zzz.
  (i) => ({ eyes: 'closed', mouth: 'none', squash: 2, bob: i % 2, zzz: true, frame: i }),
  // row 6: sulking — flat eyes, frown.
  (i) => ({ eyes: 'flat', mouth: 'frown', bob: 0, squash: i % 2 === 1 ? 1 : 0, frame: i }),
  // row 7: playing — wide eyes, open mouth, big bounce.
  (i) => ({ eyes: i % 2 === 0 ? 'wide' : 'happy', mouth: 'open', blush: true, bob: i % 2 === 0 ? -3 : 1, frame: i }),
  // row 8: curious — wide eyes, wavy mouth, lean.
  (i) => ({ eyes: 'wide', mouth: 'wavy', bob: i === 1 ? -1 : 0, sparkle: i >= 2, frame: i }),
];

rows.forEach((poseFor, row) => {
  for (let col = 0; col < COLS; col++) {
    drawFrame(col * FRAME, row * FRAME, poseFor(col));
  }
});

// --- Minimal PNG encoder ---
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
const raw = Buffer.alloc(HEIGHT * (1 + WIDTH * 4));
for (let y = 0; y < HEIGHT; y++) {
  raw[y * (1 + WIDTH * 4)] = 0; // filter: none
  Buffer.from(pixels.buffer, y * WIDTH * 4, WIDTH * 4).copy(raw, y * (1 + WIDTH * 4) + 1);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '..', 'src', 'assets', 'pet', 'pixel', 'kadomoco_sheet.png');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, png);
console.log(`wrote ${outPath} (${png.length} bytes)`);
