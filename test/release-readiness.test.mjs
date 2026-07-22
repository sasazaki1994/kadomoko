import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  readCommitSha,
  runReleaseCheck,
} from '../scripts/run-release-check.mjs';
import { checkReleaseConsistency } from '../scripts/check-release-version.mjs';

function releaseWorkspace() {
  const cwd = mkdtempSync(join(tmpdir(), 'kadomoco-release-check-'));
  mkdirSync(join(cwd, 'src/game'), { recursive: true });
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ version: '0.1.0' }));
  writeFileSync(join(cwd, 'src/game/saveData.ts'), 'export const CURRENT_SAVE_VERSION = 9;\n');
  return cwd;
}

function fixedClock() {
  let tick = 0;
  return () => new Date(Date.parse('2026-07-19T12:00:00.000Z') + tick++ * 25);
}

test('records a successful gate in JSON and Markdown without completing manual QA', async () => {
  const cwd = releaseWorkspace();
  try {
    const executed = [];
    const result = await runReleaseCheck({
      cwd,
      includeE2e: true,
      execute: async (check) => { executed.push(check.id); return 0; },
      getCommitSha: () => null,
      now: fixedClock(),
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.report.overallStatus, 'pass');
    assert.equal(result.report.manualQaStatus, 'not-tested');
    assert.equal(result.report.commitSha, null);
    assert.equal(result.report.saveVersion, 9);
    assert.equal(result.report.checks.every((check) => check.status === 'pass'), true);
    assert.equal(executed.at(-1), 'electron-e2e');
    assert.ok(existsSync(result.paths.jsonPath));
    assert.ok(existsSync(result.paths.markdownPath));
    const json = JSON.parse(readFileSync(result.paths.jsonPath, 'utf8'));
    const markdown = readFileSync(result.paths.markdownPath, 'utf8');
    assert.equal(json.manualQaStatus, 'not-tested');
    assert.match(markdown, /Overall status: \*\*PASS\*\*/);
    assert.match(markdown, /Manual Windows QA: \*\*NOT TESTED\*\*/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('stops at a failed middle step, propagates its exit code, and marks later checks not-run', async () => {
  const cwd = releaseWorkspace();
  try {
    const result = await runReleaseCheck({
      cwd,
      execute: async (check) => check.id === 'lint' ? 17 : 0,
      getCommitSha: () => 'abc123',
      now: fixedClock(),
    });
    assert.equal(result.exitCode, 17);
    assert.equal(result.report.overallStatus, 'fail');
    assert.equal(result.report.checks.find((check) => check.id === 'lint').status, 'fail');
    assert.equal(result.report.checks.find((check) => check.id === 'lint').exitCode, 17);
    assert.deepEqual(
      result.report.checks.slice(-2).map((check) => [check.id, check.status, check.exitCode]),
      [['test', 'not-run', null], ['build', 'not-run', null]],
    );
    const markdown = readFileSync(result.paths.markdownPath, 'utf8');
    assert.match(markdown, /❌ FAIL/);
    assert.match(markdown, /⏭ NOT RUN/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('does not run Windows-only checks on a non-Windows platform', async () => {
  const cwd = releaseWorkspace();
  try {
    let executions = 0;
    const result = await runReleaseCheck({
      cwd,
      windows: true,
      platform: 'linux',
      execute: async () => { executions += 1; return 0; },
      getCommitSha: () => null,
      now: fixedClock(),
    });
    assert.equal(result.exitCode, 1);
    assert.equal(executions, 0);
    assert.equal(result.report.checks.every((check) => check.status === 'not-run'), true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('an explicitly skipped Windows E2E stays not-run while packaging continues', async () => {
  const cwd = releaseWorkspace();
  try {
    const executed = [];
    const result = await runReleaseCheck({
      cwd,
      windows: true,
      skipE2e: true,
      platform: 'win32',
      execute: async (check) => { executed.push(check.id); return 0; },
      getCommitSha: () => null,
      now: fixedClock(),
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.report.checks.find((check) => check.id === 'electron-e2e').status, 'not-run');
    assert.ok(executed.includes('package-windows'));
    assert.ok(executed.includes('verify-windows-package'));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('returns a null commit when Git is unavailable', () => {
  assert.equal(readCommitSha({ env: {}, spawnCommand: () => { throw new Error('git missing'); } }), null);
});

test('accepts only commit-matched manual QA evidence and records its environment', async () => {
  const cwd = releaseWorkspace();
  try {
    writeFixture(cwd, 'qa.json', JSON.stringify({
      commitSha: 'qualified-sha',
      testedAt: '2026-07-22T01:02:03.000Z',
      overallStatus: 'passed',
      environment: { windowsVersion: 'Windows 11', displayScale: '150%', monitorCount: 2 },
    }));
    const matched = await runReleaseCheck({
      cwd,
      env: { KADOMOCO_MANUAL_QA_REPORT: 'qa.json' },
      execute: async () => 0,
      getCommitSha: () => 'qualified-sha',
      now: fixedClock(),
    });
    assert.equal(matched.report.manualQaStatus, 'passed');
    assert.equal(matched.report.manualQaCommitSha, 'qualified-sha');
    assert.equal(matched.report.manualQaTestedAt, '2026-07-22T01:02:03.000Z');
    assert.equal(matched.report.manualQaEnvironmentSummary.monitorCount, 2);

    const mismatched = await runReleaseCheck({
      cwd,
      env: { KADOMOCO_MANUAL_QA_REPORT: 'qa.json' },
      execute: async () => 0,
      getCommitSha: () => 'different-sha',
      now: fixedClock(),
    });
    assert.equal(mismatched.report.manualQaStatus, 'not-tested');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

function writeFixture(cwd, file, content) {
  const path = join(cwd, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function consistencyWorkspace({ version = '0.1.0', omitCredits = false } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'kadomoco-release-consistency-'));
  writeFixture(cwd, 'package.json', JSON.stringify({
    version,
    scripts: {
      'prepare:sheet': 'node scripts/prepare-production-sprite-sheet.mjs',
      'prepare:assets': 'npm run prepare:sheet && npm run validate:sprite:check && npm run generate:icons:raw && npm run validate:icons',
    },
    build: {
      productName: 'KadoMoco',
      win: { artifactName: '${productName}-${version}-${arch}.${ext}' },
      nsis: { deleteAppDataOnUninstall: false },
    },
  }));
  writeFixture(cwd, 'docs/release-notes-v0.1.0.md', '# KadoMoco v0.1.0 Release Notes\nNot code-signed. SmartScreen may warn.');
  writeFixture(cwd, 'docs/install-and-uninstall.md', 'Before code signing, SmartScreen may warn. Uninstall keeps app data and does not automatically delete saves.');
  writeFixture(cwd, 'CHANGELOG.md', '## [0.1.0] - Release Candidate');
  writeFixture(cwd, 'LICENSE', 'Copyright 2026. All Rights Reserved.');
  if (!omitCredits) writeFixture(cwd, 'CREDITS.md', '# Credits');
  writeFixture(cwd, 'THIRD_PARTY_NOTICES.md', '# Third-Party Notices');
  writeFixture(cwd, 'README.md', 'The generated output must not be edited directly. Canonical source: assets/source/kadomoco-generated-magenta.png.base64');
  writeFixture(cwd, '.github/workflows/release.yml', 'tag: v0.1.0\nrun: npm run release:check:win -- --release-tag $env:RELEASE_TAG\n--draft\ndocs/release-notes-v0.1.0.md');
  writeFixture(cwd, '.gitignore', 'artifacts/\nbuild/\nsrc/assets/pet/pixel/kadomoco_sheet.png\n');
  writeFixture(cwd, 'src/game/saveData.ts', 'export const CURRENT_SAVE_VERSION = 9;');
  writeFixture(cwd, 'src/game/spriteSheetSpec.json', JSON.stringify({ path: 'src/assets/pet/pixel/kadomoco_sheet.png' }));
  writeFixture(cwd, 'assets/source/kadomoco-generated-magenta.png.base64', 'iVBORw0KGgo=');
  return cwd;
}

test('release consistency rejects a missing required file', () => {
  const cwd = consistencyWorkspace({ omitCredits: true });
  try {
    assert.throws(
      () => checkReleaseConsistency({ cwd, spawnCommand: () => ({ status: 1, stdout: '' }) }),
      /CREDITS\.md must exist/,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('release consistency rejects a version mismatch', () => {
  const cwd = consistencyWorkspace({ version: '0.2.0' });
  try {
    assert.throws(
      () => checkReleaseConsistency({ cwd, spawnCommand: () => ({ status: 1, stdout: '' }) }),
      /package\.json version must remain 0\.1\.0/,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
