import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { execFileSync } from 'node:child_process';


const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const releaseDir = join(process.cwd(), 'release');
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
assert.ok(existsSync(join(appRoot, 'resources', 'app.asar')), 'ZIP must contain resources/app.asar');

const forbidden = ['src', 'test', 'e2e', 'spec', 'scripts'];
for (const name of forbidden) {
  assert.equal(existsSync(join(appRoot, name)), false, `ZIP must not include ${name}`);
}

const asarList = execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['asar', 'list', join(appRoot, 'resources', 'app.asar')], { encoding: 'utf8' });
assert.match(asarList, /\/dist\/assets\/kadomoco_sheet-.*\.png/, 'app.asar must include the sprite sheet asset');
for (const forbiddenPath of ['/src/', '/test/', '/e2e/', '/spec/', '/scripts/']) {
  assert.equal(asarList.includes(forbiddenPath), false, `app.asar must not include ${forbiddenPath}`);
}
console.log(`Windows package verification passed for ${basename(join(releaseDir, nsis))} and ${basename(join(releaseDir, zip))}.`);
