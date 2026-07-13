import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPngRgba } from './png-rgba.mjs';
const spriteSheetSpec = JSON.parse(readFileSync(join(process.cwd(), 'src/game/spriteSheetSpec.json'), 'utf8')); 

const ROOT = process.cwd();
const SPRITE_PATH = spriteSheetSpec.path;
const EXPECTED = { width: spriteSheetSpec.width, height: spriteSheetSpec.height };
const FRAME = { width: spriteSheetSpec.frameWidth, height: spriteSheetSpec.frameHeight };
const absolute = join(ROOT, SPRITE_PATH);
let failed = false;
function fail(message) { console.error(`Sprite validation failed: ${message}`); failed = true; }
function warn(message) { console.warn(`Sprite validation warning: ${message}`); }
if (!existsSync(absolute)) { fail(`${SPRITE_PATH} does not exist.`); process.exit(1); }
let png;
try { png = readPngRgba(absolute); } catch (error) { fail(error instanceof Error ? error.message : String(error)); process.exit(1); }
if (png.width !== EXPECTED.width || png.height !== EXPECTED.height) fail(`${SPRITE_PATH} must be ${EXPECTED.width}x${EXPECTED.height}px, but is ${png.width}x${png.height}px.`);
if (png.colorType !== 6) fail(`${SPRITE_PATH} must be an RGBA PNG with alpha channel; color type is ${png.colorType}.`);
const alphaAt = (x, y) => png.data[(y * png.width + x) * 4 + 3];
for (const [name, x, y] of [['top-left',0,0],['top-right',png.width-1,0],['bottom-left',0,png.height-1],['bottom-right',png.width-1,png.height-1]]) if (alphaAt(x,y)!==0) fail(`${name} corner must be transparent.`);
let magentaOpaque=0,totalOpaque=0; const hashes = new Map();
for (let r=0;r<spriteSheetSpec.rows;r++) for (let c=0;c<spriteSheetSpec.columns;c++) {
  let opaque=0, hash=2166136261;
  for (let y=0;y<FRAME.height;y++) for (let x=0;x<FRAME.width;x++) { const i=((r*FRAME.height+y)*png.width+(c*FRAME.width+x))*4; const a=png.data[i+3]; if(a>8){ opaque++; totalOpaque++; if(png.data[i]>90&&png.data[i+2]>90&&png.data[i+1]<75&&Math.abs(png.data[i]-png.data[i+2])<90) magentaOpaque++; } hash = Math.imul(hash ^ png.data[i] ^ (png.data[i+1]<<8) ^ (png.data[i+2]<<16) ^ (a<<24), 16777619) >>> 0; }
  if (opaque < 250) fail(`Cell row ${r+1}, column ${c+1} has too few opaque pixels (${opaque}).`);
  const key=hash.toString(16); if(hashes.has(key)) warn(`Cell row ${r+1}, column ${c+1} appears identical to ${hashes.get(key)}.`); else hashes.set(key, `row ${r+1}, column ${c+1}`);
}
const magentaRatio = totalOpaque ? magentaOpaque / totalOpaque : 1;
if (magentaRatio > 0.002) fail(`Too much opaque magenta remains (${(magentaRatio*100).toFixed(2)}% of opaque pixels).`);
if (failed) process.exit(1);
console.log(`Sprite validation passed: ${SPRITE_PATH} is ${png.width}x${png.height}px RGBA PNG with 32 non-empty transparent-background frames.`);
