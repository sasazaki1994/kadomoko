import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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

test('the Windows package verifier CLI executes instead of silently returning', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'kadomoco-package-cli-'));
  try {
    const result = spawnSync(
      process.execPath,
      [join(process.cwd(), 'scripts/verify-windows-package.mjs')],
      { cwd, encoding: 'utf8' },
    );
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /release directory must exist/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
