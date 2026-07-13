import test from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import electronPath from 'electron';

const userDataDir = join(process.cwd(), '.tmp-e2e-user-data');
const env = { ...process.env, NODE_ENV: 'production', KADOMOCO_E2E: '1' };

function parseReadySettings(output) {
  const match = output.match(/\[kadomoco-e2e-ready\] (.+)/);
  assert.ok(match, `Missing ready marker in output:\n${output}`);
  return Object.fromEntries(match[1].trim().split(/\s+/).map((entry) => entry.split('=')));
}

function launch() {
  const child = spawn(electronPath, ['dist-electron/main.js', `--user-data-dir=${userDataDir}`], {
    cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  return { child, getOutput: () => output };
}

async function waitForOutput(getOutput, marker) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const output = getOutput();
    if (output.includes(marker)) return 'ready';
    if (output.includes('error while loading shared libraries')) return 'missing-linux-gui-libs';
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(`Timed out waiting for ${marker}. Output:\n${getOutput()}`);
}

test('Electron production smoke test exposes safe window behavior', { timeout: 25_000 }, async (t) => {
  rmSync(userDataDir, { recursive: true, force: true });
  const app = launch();
  try {
    const status = await waitForOutput(app.getOutput, '[kadomoco-e2e-ready]');
    if (status === 'missing-linux-gui-libs') {
      t.skip(`Electron runtime libraries are missing in this environment: ${app.getOutput().trim()}`);
      return;
    }
    const settings = parseReadySettings(app.getOutput());
    assert.equal(settings.frameless, 'true');
    assert.equal(settings.transparent, 'true');
    assert.equal(settings.skipTaskbar, 'true');
    assert.equal(settings.devTools, 'false');
    app.child.kill('SIGTERM');
  } finally {
    if (!app.child.killed) app.child.kill('SIGTERM');
    rmSync(userDataDir, { recursive: true, force: true });
  }
});
