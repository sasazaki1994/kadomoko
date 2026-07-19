import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const localRequire = createRequire(__filename);
const { assertAsarContents, normalizeArchivePath } = localRequire(join(process.cwd(), 'scripts/verify-windows-package-utils.cjs')) as {
  assertAsarContents: (entries: string[]) => void;
  normalizeArchivePath: (filePath: string) => string;
};

test('normalizes Windows archive paths before checking app.asar contents', () => {
  assert.equal(normalizeArchivePath('dist\\assets\\kadomoco_sheet-abc123.png'), '/dist/assets/kadomoco_sheet-abc123.png');
  assert.doesNotThrow(() => assertAsarContents(['dist\\assets\\kadomoco_sheet-abc123.png']));
});

test('rejects app.asar contents with forbidden source directories', () => {
  assert.throws(
    () => assertAsarContents(['/dist/assets/kadomoco_sheet-abc123.png', 'scripts/verify-windows-package.mjs']),
    /app\.asar must not include \/scripts\//,
  );
});

test('rejects app.asar contents without the production sprite sheet', () => {
  assert.throws(
    () => assertAsarContents(['/dist/assets/other.png']),
    /app\.asar must include the sprite sheet asset/,
  );
});
