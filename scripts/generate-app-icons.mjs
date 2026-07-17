import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPngRgba, writePngRgba } from './png-rgba.mjs';

const specPath = process.env.SPRITE_SPEC_PATH ?? 'src/game/spriteSheetSpec.json';
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const sheetPath = process.env.SPRITE_SHEET_PATH ?? spec.path;
const outDir = process.env.ICON_OUTPUT_DIR ?? 'build';
const sizes = [16, 24, 32, 48, 64, 128, 256];
if (!existsSync(sheetPath)) throw new Error(`Icon source sprite does not exist: ${sheetPath}`);
let sheet;
try { sheet = readPngRgba(sheetPath); } catch (error) { throw new Error(`Cannot decode icon source sprite ${sheetPath}: ${error instanceof Error ? error.message : String(error)}`); }
const expectedWidth = spec.frameWidth * spec.columns, expectedHeight = spec.frameHeight * spec.rows;
if (sheet.width !== expectedWidth || sheet.height !== expectedHeight) throw new Error(`Icon source sprite ${sheetPath} must be ${expectedWidth}x${expectedHeight}px, but is ${sheet.width}x${sheet.height}px.`);
const frame = spec.frameWidth;
if (spec.frameWidth !== spec.frameHeight) throw new Error('Icon generation requires square sprite frames.');
mkdirSync(outDir, { recursive: true });
const src = Buffer.alloc(frame * frame * 4);
for (let y = 0; y < frame; y++) for (let x = 0; x < frame; x++) {
  const si = (y * sheet.width + x) * 4;
  const di = (y * frame + x) * 4;
  sheet.data.copy(src, di, si, si + 4);
}
function bbox(data, w, h) { let minX=w,minY=h,maxX=-1,maxY=-1; for(let y=0;y<h;y++)for(let x=0;x<w;x++){ if(data[(y*w+x)*4+3]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);} } return {minX,minY,maxX,maxY,w:maxX-minX+1,h:maxY-minY+1}; }
const b = bbox(src, frame, frame);
if (b.w <= 0 || b.h <= 0) throw new Error(`The first frame in icon source sprite ${sheetPath} has no opaque pixels.`);
function makeIcon(size) {
  const out = Buffer.alloc(size * size * 4);
  const scale = (size * 0.72) / Math.max(b.w, b.h);
  const dw = Math.max(1, Math.floor(b.w * scale));
  const dh = Math.max(1, Math.floor(b.h * scale));
  const dx = Math.floor((size - dw) / 2);
  const dy = Math.floor((size - dh) / 2);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const sx = Math.min(b.w - 1, Math.floor(x / scale));
    const sy = Math.min(b.h - 1, Math.floor(y / scale));
    const si = ((b.minY + sy) * frame + (b.minX + sx)) * 4;
    if (!src[si + 3]) continue;
    const di = ((dy + y) * size + (dx + x)) * 4;
    src.copy(out, di, si, si + 4);
  }
  return out;
}

const pngs = [];
for (const size of sizes) {
  const data = makeIcon(size);
  const pngPath = join(outDir, `icon-${size}.png`);
  writePngRgba(pngPath, size, size, data);
  const decoded = readPngRgba(pngPath);
  if (decoded.width !== size || decoded.height !== size) throw new Error(`Generated icon is not decodable at ${pngPath}`);
  pngs.push({ size, data: readFileSync(pngPath) });
}
writePngRgba(join(outDir, 'icon.png'), 256, 256, makeIcon(256));
writePngRgba(join(outDir, 'tray-icon.png'), 32, 32, makeIcon(32));
const header = Buffer.alloc(6); header.writeUInt16LE(0,0); header.writeUInt16LE(1,2); header.writeUInt16LE(pngs.length,4);
let offset = 6 + pngs.length * 16;
const entries = [];
for (const p of pngs) { const e=Buffer.alloc(16); e[0]=p.size===256?0:p.size; e[1]=p.size===256?0:p.size; e[2]=0; e[3]=0; e.writeUInt16LE(1,4); e.writeUInt16LE(32,6); e.writeUInt32LE(p.data.length,8); e.writeUInt32LE(offset,12); entries.push(e); offset += p.data.length; }
const ico = Buffer.concat([header, ...entries, ...pngs.map(p=>p.data)]);
if (!ico.length) throw new Error('Generated ICO is empty.');
writeFileSync(join(outDir, 'icon.ico'), ico);
console.log(`Generated ${join(outDir, 'icon.ico')}, ${join(outDir, 'tray-icon.png')}, ${join(outDir, 'icon.png')}`);
