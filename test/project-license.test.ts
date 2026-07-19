import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

type Overrides = { license?: string | null; packageLicense?: string | null; private?: boolean; readme?: string; notes?: string };

function fixture(overrides: Overrides = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'kadomoco-license-'));
  mkdirSync(join(cwd, 'docs'));
  const pkg: Record<string, unknown> = { name: 'demo', private: overrides.private ?? true, license: overrides.packageLicense === undefined ? 'UNLICENSED' : overrides.packageLicense };
  if (overrides.packageLicense === null) delete pkg.license;
  writeFileSync(join(cwd, 'package.json'), JSON.stringify(pkg));
  if (overrides.license !== null) writeFileSync(join(cwd, 'LICENSE'), overrides.license ?? 'Copyright © 2026 sasazaki1994. All Rights Reserved. Proprietary software.');
  writeFileSync(join(cwd, 'README.md'), overrides.readme ?? 'KadoMoco is proprietary. All Rights Reserved.');
  writeFileSync(join(cwd, 'docs', 'release-notes-v0.1.0.md'), overrides.notes ?? 'KadoMoco v0.1.0 is proprietary. All Rights Reserved.');
  return cwd;
}

function run(cwd: string, requireMode = false) {
  const script = join(process.cwd(), 'scripts/check-project-license.mjs');
  const result = spawnSync(process.execPath, [script, requireMode ? '--require' : '--warn'], { cwd, encoding: 'utf8' });
  return { ...result, json: JSON.parse(result.stdout) as { ok: boolean; status: string; checks: Record<string, boolean> } };
}

test('accepts the complete proprietary All Rights Reserved configuration', () => {
  const cwd = fixture();
  try { const result = run(cwd, true); assert.equal(result.status, 0); assert.equal(result.json.ok, true); assert.equal(result.json.status, 'decided'); } finally { rmSync(cwd, { recursive: true }); }
});

for (const scenario of [
  ['missing LICENSE', { license: null }, 'licenseExists'],
  ['missing package license', { packageLicense: null }, 'packageLicense'],
  ['MIT package license', { packageLicense: 'MIT' }, 'packageLicense'],
  ['non-private package', { private: false }, 'packagePrivate'],
  ['different copyright holder', { license: 'Copyright © 2026 somebody-else. All Rights Reserved.' }, 'licenseCopyrightHolder'],
  ['undecided wording in README', { readme: 'Proprietary. The license is not decided.' }, 'readmeHasNoUndecidedLanguage'],
  ['undecided wording in release notes', { notes: 'Proprietary. ライセンス未決定。' }, 'releaseNotesHaveNoUndecidedLanguage'],
] as const) {
  test(`rejects ${scenario[0]}`, () => {
    const cwd = fixture(scenario[1]);
    try { const result = run(cwd); assert.equal(result.json.ok, false); assert.equal(result.json.checks[scenario[2]], false); } finally { rmSync(cwd, { recursive: true }); }
  });
}

test('--require exits non-zero for an invalid configuration', () => {
  const cwd = fixture({ packageLicense: 'MIT' });
  try {
    const script = join(process.cwd(), 'scripts/check-project-license.mjs');
    assert.throws(() => execFileSync(process.execPath, [script, '--require'], { cwd, stdio: 'pipe' }));
  } finally { rmSync(cwd, { recursive: true }); }
});
