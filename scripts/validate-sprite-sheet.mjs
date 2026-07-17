import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readPngRgba } from './png-rgba.mjs';

export function validateSpriteSheet({
  root = process.cwd(),
  specPath = process.env.SPRITE_SPEC_PATH ?? 'src/game/spriteSheetSpec.json',
  sheetPath = process.env.SPRITE_SHEET_PATH,
} = {}) {
  const spec = JSON.parse(readFileSync(resolve(root, specPath), 'utf8'));
  const relative = sheetPath ?? spec.path;
  const absolute = resolve(root, relative);
  if (!existsSync(absolute)) throw new Error(`${relative} does not exist.`);
  let png;
  try { png = readPngRgba(absolute); }
  catch (error) { throw new Error(`${relative}: ${error instanceof Error ? error.message : String(error)}`); }
  const expectedWidth = spec.frameWidth * spec.columns;
  const expectedHeight = spec.frameHeight * spec.rows;
  if (png.width !== expectedWidth || png.height !== expectedHeight) throw new Error(`${relative} must be ${expectedWidth}x${expectedHeight}px, but is ${png.width}x${png.height}px.`);
  if (spec.width !== expectedWidth || spec.height !== expectedHeight) throw new Error('spriteSheetSpec dimensions do not match its frame grid.');
  if (png.colorType !== 6) throw new Error(`${relative} must be an RGBA PNG with alpha channel; color type is ${png.colorType}.`);
  const alphaAt = (x, y) => png.data[(y * png.width + x) * 4 + 3];
  for (const [name,x,y] of [['top-left',0,0],['top-right',png.width-1,0],['bottom-left',0,png.height-1],['bottom-right',png.width-1,png.height-1]]) if(alphaAt(x,y)!==0) throw new Error(`${name} corner must be transparent.`);
  let magentaOpaque=0,totalOpaque=0; const hashes=new Map(); const warnings=[];
  for(let r=0;r<spec.rows;r++) for(let c=0;c<spec.columns;c++) {
    let opaque=0,hash=2166136261;
    for(let y=0;y<spec.frameHeight;y++) for(let x=0;x<spec.frameWidth;x++) { const i=((r*spec.frameHeight+y)*png.width+(c*spec.frameWidth+x))*4; const a=png.data[i+3]; if(a>8){opaque++;totalOpaque++;if(png.data[i]>90&&png.data[i+2]>90&&png.data[i+1]<75&&Math.abs(png.data[i]-png.data[i+2])<90)magentaOpaque++;} hash=Math.imul(hash^png.data[i]^(png.data[i+1]<<8)^(png.data[i+2]<<16)^(a<<24),16777619)>>>0; }
    if(opaque<250) throw new Error(`Cell row ${r+1}, column ${c+1} has too few opaque pixels (${opaque}).`);
    const key=hash.toString(16); if(hashes.has(key)) warnings.push(`Cell row ${r+1}, column ${c+1} appears identical to ${hashes.get(key)}.`); else hashes.set(key,`row ${r+1}, column ${c+1}`);
  }
  const ratio=totalOpaque?magentaOpaque/totalOpaque:1;
  if(ratio>0.002) throw new Error(`Too much opaque magenta remains (${(ratio*100).toFixed(2)}% of opaque pixels).`);
  return { path: relative, width: png.width, height: png.height, frames: spec.rows*spec.columns, warnings };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { const result=validateSpriteSheet(); for(const warning of result.warnings) console.warn(`Sprite validation warning: ${warning}`); console.log(`Sprite validation passed: ${result.path} is ${result.width}x${result.height}px RGBA PNG with ${result.frames} non-empty transparent-background frames.`); }
  catch(error) { console.error(`Sprite validation failed: ${error instanceof Error?error.message:String(error)}`); process.exitCode=1; }
}
