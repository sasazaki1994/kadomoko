import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { listPackage } from '@electron/asar';

const require = createRequire(import.meta.url);
export const { assertAsarContents, normalizeArchivePath } = require('./verify-windows-package-utils.cjs');

export function listAsarEntries(appAsarPath) {
  return listPackage(appAsarPath);
}

export function verifyWindowsPackage({ cwd = process.cwd(), listEntries = listAsarEntries } = {}) {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const releaseDir = join(cwd, 'release');
  assert.ok(existsSync(releaseDir), 'release directory must exist');
  const files = readdirSync(releaseDir);
  const version = packageJson.version;
  const expectedBase = `KadoMoco-${version}-x64`;
  const nsis = files.find((file) => file === `${expectedBase}.exe`);
  const zip = files.find((file) => file === `${expectedBase}.zip`);
  assert.ok(nsis, `missing NSIS installer named ${expectedBase}.exe`);
  assert.ok(zip, `missing ZIP package named ${expectedBase}.zip`);
  for (const file of [nsis, zip]) {
    assert.ok(statSync(join(releaseDir, file)).size > 0, `${file} must not be empty`);
  }

  const extractDir = join(releaseDir, 'verify-zip');
  rmSync(extractDir, { recursive: true, force: true });
  mkdirSync(extractDir, { recursive: true });
  execFileSync('tar', ['-xf', join(releaseDir, zip), '-C', extractDir], { stdio: 'inherit' });

  const rootEntries = readdirSync(extractDir);
  const appRoot = rootEntries.includes('KadoMoco.exe') ? extractDir : join(extractDir, rootEntries[0] ?? '');
  assert.ok(existsSync(join(appRoot, 'KadoMoco.exe')), 'ZIP must contain KadoMoco.exe');
  assert.ok(existsSync(join(appRoot, 'resources')), 'ZIP must contain resources directory');
  assert.ok(existsSync(join(appRoot, 'resources', 'tray-icon.png')), 'ZIP must contain resources/tray-icon.png');
  assert.ok(statSync(join(appRoot, 'resources', 'tray-icon.png')).size > 0, 'resources/tray-icon.png must not be empty');
  const packagedLicense = join(appRoot, 'resources', 'LICENSE');
  const packagedNotices = join(appRoot, 'resources', 'THIRD_PARTY_NOTICES.md');
  assert.ok(existsSync(packagedLicense), 'ZIP must contain resources/LICENSE');
  assert.ok(statSync(packagedLicense).size > 0, 'resources/LICENSE must not be empty');
  assert.match(readFileSync(packagedLicense, 'utf8'), /All Rights Reserved/, 'resources/LICENSE must contain All Rights Reserved');
  assert.match(readFileSync(packagedLicense, 'utf8'), /sasazaki1994/, 'resources/LICENSE must identify sasazaki1994');
  assert.ok(existsSync(packagedNotices), 'ZIP must contain resources/THIRD_PARTY_NOTICES.md');
  assert.ok(statSync(packagedNotices).size > 0, 'resources/THIRD_PARTY_NOTICES.md must not be empty');
  const notices = readFileSync(packagedNotices, 'utf8');
  assert.match(notices, /^# Third-Party Notices/m, 'resources/THIRD_PARTY_NOTICES.md must contain its heading');
  assert.doesNotMatch(notices, /\bUNKNOWN\b/, 'resources/THIRD_PARTY_NOTICES.md must not contain UNKNOWN licenses');
  const appAsarPath = join(appRoot, 'resources', 'app.asar');
  assert.ok(existsSync(appAsarPath), 'ZIP must contain resources/app.asar');

  const forbidden = ['src', 'test', 'e2e', 'spec', 'scripts'];
  for (const name of forbidden) {
    assert.equal(existsSync(join(appRoot, name)), false, `ZIP must not include ${name}`);
  }

  assertAsarContents(listEntries(appAsarPath));
  console.log(`Windows package verification passed for ${basename(join(releaseDir, nsis))} and ${basename(join(releaseDir, zip))}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifyWindowsPackage();
}
