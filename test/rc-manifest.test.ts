import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('creates an RC manifest with per-artifact sizes and hashes without guessing missing statuses', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'kadomoco-rc-'));
  mkdirSync(join(cwd, 'release'));
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'kado-moco', version: '0.1.0', build: { productName: 'KadoMoco' } }));
  writeFileSync(join(cwd, 'release', 'KadoMoco-0.1.0-x64.exe'), 'installer');
  writeFileSync(join(cwd, 'release', 'KadoMoco-0.1.0-x64.zip'), 'zip');
  const output = join(cwd, 'release', 'rc-manifest.json');

  execFileSync(process.execPath, [join(process.cwd(), 'scripts/create-rc-manifest.mjs'), '--output', output], {
    cwd,
    env: { ...process.env, GITHUB_SHA: 'abc123', RC_SOURCE_REF: 'main' },
  });

  const manifest = JSON.parse(readFileSync(output, 'utf8')) as {
    applicationName: string;
    version: string;
    commitSha: string;
    sourceRef: string;
    spriteValidation: string;
    artifacts: Array<{ artifactName: string; artifactSize: number; sha256: string }>;
  };
  assert.equal(manifest.applicationName, 'KadoMoco');
  assert.equal(manifest.version, '0.1.0');
  assert.equal(manifest.commitSha, 'abc123');
  assert.equal(manifest.sourceRef, 'main');
  assert.equal(manifest.spriteValidation, 'not-recorded');
  assert.deepEqual(manifest.artifacts.map((artifact) => artifact.artifactName), ['KadoMoco-0.1.0-x64.exe', 'KadoMoco-0.1.0-x64.zip']);
  assert.equal(manifest.artifacts[0].artifactSize, 9);
  assert.match(manifest.artifacts[0].sha256, /^[0-9a-f]{64}$/);
});
