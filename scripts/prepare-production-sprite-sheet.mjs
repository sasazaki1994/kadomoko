import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { readPngRgba, writePngRgba } from './png-rgba.mjs';

const embeddedSourcePath = 'assets/source/kadomoco-generated-magenta.png.base64';
const decodedSourcePath = '.tmp-sprite-source.png';
const sourceArg = process.argv[2];
const sourcePath = sourceArg ?? decodedSourcePath;
const outPath = 'src/assets/pet/pixel/kadomoco_sheet.png';
const previewPath = 'artifacts/kadomoco_sheet_preview.png';
const htmlPath = 'artifacts/kadomoco_sprite_preview.html';
const rows = ['normal', 'happy', 'hungry', 'sleepy', 'sleeping', 'sulking', 'playing', 'curious'];
const cols = 4;
const rowCount = 8;
const cell = 64;

mkdirSync(dirname(outPath), { recursive: true });
mkdirSync('artifacts', { recursive: true });

if (!sourceArg) {
  if (!existsSync(embeddedSourcePath)) throw new Error(`${embeddedSourcePath} does not exist.`);
  const base64 = readFileSync(embeddedSourcePath, 'utf8').replace(/\s+/g, '');
  writeFileSync(decodedSourcePath, Buffer.from(base64, 'base64'));
}

try {
const src = readPngRgba(sourcePath);
const bgSamples = [[0, 0], [src.width - 1, 0], [0, src.height - 1], [src.width - 1, src.height - 1]].map(([x, y]) => {
  const i = (y * src.width + x) * 4;
  return [src.data[i], src.data[i + 1], src.data[i + 2]];
});
const bg = bgSamples.reduce((a, c) => a.map((v, i) => v + c[i]), [0, 0, 0]).map((v) => Math.round(v / bgSamples.length));
const bgTol = 95;
const despillTol = 150;
function dist(i) { const dr = src.data[i] - bg[0], dg = src.data[i + 1] - bg[1], db = src.data[i + 2] - bg[2]; return Math.sqrt(dr * dr + dg * dg + db * db); }
function isFgAt(x, y) { const i = (y * src.width + x) * 4; return !(dist(i) <= bgTol && src.data[i] > 160 && src.data[i + 2] > 120 && src.data[i + 1] < 90); }

function projectionRuns(axis, threshold) {
  const limit = axis === 'y' ? src.height : src.width;
  const inner = axis === 'y' ? src.width : src.height;
  const runs = [];
  let open = false;
  for (let a = 0; a < limit; a++) {
    let hits = 0;
    for (let b = 0; b < inner; b++) {
      const x = axis === 'y' ? b : a;
      const y = axis === 'y' ? a : b;
      if (isFgAt(x, y)) hits++;
    }
    if (hits > threshold && !open) { runs.push([a, a]); open = true; }
    if (open) runs[runs.length - 1][1] = a;
    if (hits <= threshold && open) open = false;
  }
  return runs.filter(([a, b]) => b - a > 20);
}
const rowBands = projectionRuns('y', 20);
if (rowBands.length !== rowCount) throw new Error(`Expected ${rowCount} row bands, got ${rowBands.length}: ${JSON.stringify(rowBands)}`);

const out = Buffer.alloc(cols * cell * rowCount * cell * 4);
const report = [];
for (let r = 0; r < rowCount; r++) for (let c = 0; c < cols; c++) {
  const x0 = Math.floor(c * src.width / cols), x1 = Math.floor((c + 1) * src.width / cols);
  const [bandY0, bandY1] = rowBands[r];
  const y0 = Math.max(0, bandY0 - 2), y1 = Math.min(src.height, bandY1 + 3);
  let minX = x1, minY = y1, maxX = x0, maxY = y0, count = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (isFgAt(x, y)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); count++; }
  if (count < 200) throw new Error(`Could not detect character in row ${r + 1} col ${c + 1}`);
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  const frameScale = Math.min((cell - 8) / bw, (cell - 4) / bh, 1);
  const dw = Math.max(1, Math.round(bw * frameScale)), dh = Math.max(1, Math.round(bh * frameScale));
  const dx = Math.round((cell - dw) / 2);
  let foot = 59;
  if (rows[r] === 'happy' || rows[r] === 'playing') foot = c % 2 ? 57 : 59;
  if (rows[r] === 'sleeping') foot = 57;
  const dy = Math.max(2, Math.min(cell - dh - 1, foot - dh));
  for (let yy = 0; yy < dh; yy++) for (let xx = 0; xx < dw; xx++) {
    const sx = minX + Math.min(bw - 1, Math.floor(xx / frameScale));
    const sy = minY + Math.min(bh - 1, Math.floor(yy / frameScale));
    const si = (sy * src.width + sx) * 4;
    const oi = ((r * cell + dy + yy) * (cols * cell) + (c * cell + dx + xx)) * 4;
    const d = dist(si);
    let a = 255;
    if (d <= bgTol && src.data[si] > 160 && src.data[si + 2] > 120 && src.data[si + 1] < 100) a = 0;
    else if ((d <= despillTol && src.data[si] > 180 && src.data[si + 2] > 140 && src.data[si + 1] < 120) || (src.data[si] > 90 && src.data[si + 2] > 90 && src.data[si + 1] < 75 && Math.abs(src.data[si] - src.data[si + 2]) < 90)) a = 0;
    if (a) { out[oi] = src.data[si]; out[oi + 1] = src.data[si + 1]; out[oi + 2] = src.data[si + 2]; out[oi + 3] = 255; }
  }
  report.push({ row: r + 1, state: rows[r], frame: c + 1, bbox: [minX, minY, maxX, maxY], sourceSize: [bw, bh], placed: [dx, dy, dw, dh], opaqueSourcePixels: count });
}
if (report.length !== 32) throw new Error(`Expected 32 frames, got ${report.length}`);
writePngRgba(outPath, cols * cell, rowCount * cell, out);

const previewScale = 4;
const pw = cols * cell * previewScale, ph = rowCount * cell * previewScale;
const prev = Buffer.alloc(pw * ph * 4);
for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
  const check = ((Math.floor(x / 16) + Math.floor(y / 16)) & 1) ? 210 : 245;
  const si = (Math.floor(y / previewScale) * cols * cell + Math.floor(x / previewScale)) * 4;
  const di = (y * pw + x) * 4;
  const a = out[si + 3] / 255;
  prev[di] = Math.round(out[si] * a + check * (1 - a));
  prev[di + 1] = Math.round(out[si + 1] * a + check * (1 - a));
  prev[di + 2] = Math.round(out[si + 2] * a + check * (1 - a));
  prev[di + 3] = 255;
}
writePngRgba(previewPath, pw, ph, prev);
writeFileSync(htmlPath, `<!doctype html><meta charset="utf-8"><title>KadoMoco sprite preview</title><style>body{font-family:sans-serif;background:#222;color:white}.stage{width:256px;height:256px;image-rendering:pixelated;background-image:url('../${outPath}');background-size:1024px 2048px;animation:frames .8s steps(4) infinite;transform-origin:top left}button{margin:4px}@keyframes frames{to{background-position-x:-1024px}}</style><h1>KadoMoco sprite preview</h1><p>Rows: ${rows.join(', ')}</p><div id="buttons"></div><div class="stage" id="stage"></div><script>const rows=${JSON.stringify(rows)};const stage=document.getElementById('stage');document.getElementById('buttons').innerHTML=rows.map((r,i)=>'<button data-row="'+i+'">'+r+'</button>').join('');document.getElementById('buttons').addEventListener('click',e=>{if(e.target.dataset.row)stage.style.backgroundPositionY=(-Number(e.target.dataset.row)*256)+'px';});</script>`);
console.log(JSON.stringify({ source: sourcePath, output: outPath, background: bg, tolerance: bgTol, rowBands, frames: report }, null, 2));
} finally {
  if (!sourceArg) rmSync(decodedSourcePath, { force: true });
}
