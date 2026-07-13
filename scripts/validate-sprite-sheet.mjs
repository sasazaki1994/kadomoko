import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SPRITE_PATH = 'src/assets/pet/pixel/kadomoco_sheet.png';
const EXPECTED = { width: 256, height: 512 };
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fail(message) {
  console.error(`Sprite validation failed: ${message}`);
  process.exitCode = 1;
}

const absolute = join(ROOT, SPRITE_PATH);
if (!existsSync(absolute)) {
  fail(`${SPRITE_PATH} does not exist.`);
  process.exit();
}

const data = readFileSync(absolute);
if (data.length < 24 || !data.subarray(0, 8).equals(PNG_SIGNATURE)) {
  fail(`${SPRITE_PATH} is not a PNG file.`);
  process.exit();
}

const width = data.readUInt32BE(16);
const height = data.readUInt32BE(20);
if (width !== EXPECTED.width || height !== EXPECTED.height) {
  fail(`${SPRITE_PATH} must be ${EXPECTED.width}x${EXPECTED.height}px, but is ${width}x${height}px.`);
  process.exit();
}

console.log(`Sprite validation passed: ${SPRITE_PATH} is ${width}x${height}px PNG.`);
