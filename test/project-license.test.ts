import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('warn mode reports undecided project license without selecting one', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'kadomoco-license-'));
  mkdirSync(join(cwd, 'docs'));
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'demo' }));
  writeFileSync(join(cwd, 'README.md'), 'License decision pending.');
  writeFileSync(join(cwd, 'docs', 'release-notes-v0.1.0.md'), 'License undecided.');

  const output = execFileSync(process.execPath, [join(process.cwd(), 'scripts/check-project-license.mjs'), '--warn'], { cwd, encoding: 'utf8' });
  const result = JSON.parse(output) as { ok: boolean; status: string; checks: { licenseExists: boolean } };
  assert.equal(result.ok, false);
  assert.equal(result.status, 'undecided');
  assert.equal(result.checks.licenseExists, false);
});
