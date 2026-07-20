import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import electronPath from 'electron';

const envBase = { ...process.env, NODE_ENV: 'production', KADOMOCO_E2E: '1' };

function launch({ userDataDir, scenario = 'window', extraEnv = [] } = {}) {
  const removeUserDataDir = userDataDir === undefined;
  userDataDir ??= mkdtempSync(join(tmpdir(), 'kadomoco-e2e-'));
  const env = { ...envBase, KADOMOCO_E2E_SCENARIO: scenario, ...extraEnv };
  const args = ['dist-electron/main.js', `--user-data-dir=${userDataDir}`];
  if (process.platform === 'linux' && env.KADOMOCO_E2E === '1') args.unshift('--no-sandbox');
  const child = spawn(electronPath, args, {
    cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  return { child, userDataDir, removeUserDataDir, getOutput: () => output };
}

function killProcessTree(child) {
  if (child.pid === undefined) return;
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    killer.on('error', () => child.kill('SIGKILL'));
  } else {
    child.kill('SIGKILL');
  }
}

function waitForExit(child, timeout = 5_000, killGrace = 5_000) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    let forceTimer;
    let fallbackTimer;
    const cleanup = () => {
      clearTimeout(forceTimer);
      clearTimeout(fallbackTimer);
      child.off('close', done);
      child.off('exit', done);
      child.off('error', done);
    };
    const done = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    child.once('close', done);
    child.once('exit', done);
    child.once('error', done);
    forceTimer = setTimeout(() => {
      killProcessTree(child);
      fallbackTimer = setTimeout(done, killGrace);
    }, timeout);
    child.kill('SIGTERM');
  });
}

async function rmRetry(path) {
  for (let i = 0; i < 8; i += 1) {
    try { rmSync(path, { recursive: true, force: true }); return; }
    catch (error) { if (i === 7) throw error; await new Promise((resolve) => setTimeout(resolve, 150 * (i + 1))); }
  }
}

async function waitFor(app, marker, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const output = app.getOutput();
    if (output.includes(marker)) return output;
    if (app.child.exitCode !== null || app.child.signalCode !== null) {
      assert.fail(`Electron exited before ${marker} (code=${app.child.exitCode}, signal=${app.child.signalCode}). Output:\n${output}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`Timed out waiting for ${marker}. Output:\n${app.getOutput()}`);
}

function readMarker(output, marker) {
  const line = output.split(/\r?\n/).find((entry) => entry.startsWith(marker));
  assert.ok(line, `Missing ${marker} in output:\n${output}`);
  return JSON.parse(line.slice(marker.length).trim());
}

async function runScenario(t, options) {
  const app = launch(options);
  try {
    const output = await waitFor(app, '[kadomoco-e2e-result]');
    if (output.skip) {
      t.skip(output.skip);
      return null;
    }
    const result = readMarker(output, '[kadomoco-e2e-result]');
    assert.equal(result.ok, true, result.error || output);
    assert.deepEqual(result.consoleErrors, []);
    assert.deepEqual(result.unhandledErrors, []);
    return { result, app };
  } finally {
    await waitForExit(app.child);
    if (app.removeUserDataDir) await rmRetry(app.userDataDir);
  }
}

test('Electron production window uses release-safe options', { timeout: 25_000 }, async (t) => {
  const run = await runScenario(t, { scenario: 'window' });
  if (!run) return;
  assert.equal(run.result.windowCount, 1);
  assert.equal(run.result.frameless, true);
  assert.equal(run.result.transparent, true);
  assert.equal(run.result.skipTaskbar, true);
  assert.deepEqual(run.result.initialSize, [180, 180]);
  assert.equal(run.result.devButtonVisible, false);
});

test('Electron renderer supports core care and panel flows', { timeout: 25_000 }, async (t) => {
  const run = await runScenario(t, { scenario: 'interaction' });
  if (!run) return;
  assert.equal(run.result.leftClickReacted, true);
  assert.equal(run.result.menuOpened, true);
  assert.equal(run.result.escapeClosedMenu, true);
  assert.equal(run.result.doubleClickOpenedPanel, true);
  assert.equal(run.result.doubleClickClosedPanel, true);
  assert.equal(run.result.feedUpdatedExpOrStatus, true);
  assert.equal(run.result.cooldownRejected, true);
  assert.equal(run.result.cooldownBubble, 'ちょっと待って');
  assert.equal(run.result.blockedPlayReasonShown, true);
  assert.equal(run.result.blockedPlayBubble, 'ちょっと眠い');
  assert.equal(run.result.directBubbleSurvivedAmbientTick, true);
});

test('Electron panels resize safely and remain mutually exclusive', { timeout: 25_000 }, async (t) => {
  const run = await runScenario(t, { scenario: 'panels' });
  if (!run) return;
  assert.deepEqual(run.result.expandedSize, [240, 240]);
  assert.deepEqual(run.result.normalSize, [180, 180]);
  assert.equal(run.result.onlyOnePanelAtATime, true);
  assert.equal(run.result.allPanelsFit, true, JSON.stringify(run.result.panelFits));
});

test('Electron save data, settings, and window position survive restart', { timeout: 35_000 }, async (t) => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'kadomoco-e2e-persist-'));
  try {
    const first = await runScenario(t, { userDataDir, scenario: 'persist-write' });
    if (!first) return;
    const second = await runScenario(t, { userDataDir, scenario: 'persist-read' });
    if (!second) return;
    assert.equal(second.result.petRestored, true);
    assert.equal(second.result.positionRestored, true);
    assert.equal(second.result.alwaysOnTopRestored, true);
  } finally {
    await rmRetry(userDataDir);
  }
});

test('Electron recovers from corrupt save files without crashing', { timeout: 25_000 }, async (t) => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'kadomoco-e2e-corrupt-'));
  const primary = join(userDataDir, 'kadomoco-save.json');
  const backup = join(userDataDir, 'kadomoco-save-backup.json');
  const backupPayload = { version: 1, pet: null, settings: { alwaysOnTop: true, volume: 50, statusDisplayMode: 'both', ambientFrequency: 'normal', bubbleFrequency: 'normal', reduceActivityWhenFullscreen: true }, windowPosition: { x: 42, y: 42 }, lastLaunchedAt: 1 };
  try {
    writeFileSync(primary, '{broken json');
    writeFileSync(backup, JSON.stringify(backupPayload));
    const backupRun = await runScenario(t, { userDataDir, scenario: 'persist-read' });
    if (!backupRun) return;
    assert.equal(backupRun.result.alwaysOnTopRestored, true);
    const restartAfterBackupRecovery = await runScenario(t, { userDataDir, scenario: 'persist-read' });
    if (!restartAfterBackupRecovery) return;
    assert.equal(restartAfterBackupRecovery.result.alwaysOnTopRestored, true);
    writeFileSync(primary, '{broken json');
    writeFileSync(backup, '{broken json');
    const fallbackRun = await runScenario(t, { userDataDir, scenario: 'persist-read' });
    if (!fallbackRun) return;
    assert.equal(fallbackRun.result.loadedInitialFallback, true);
  } finally {
    await rmRetry(userDataDir);
  }
});

test('Electron close hides, tray actions reuse window, and quit exits', { timeout: 25_000 }, async (t) => {
  const run = await runScenario(t, { scenario: 'lifecycle' });
  if (!run) return;
  assert.equal(run.result.closeHidWindow, true);
  assert.equal(run.result.showReusedWindow, true);
  assert.equal(run.result.trayAlwaysOnTopSynced, true);
  assert.equal(run.result.quitRequested, true);
});
