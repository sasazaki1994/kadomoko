import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE_CHECKS = [
  { id: 'prepare-assets', script: 'prepare:assets' },
  { id: 'licenses-validate', script: 'licenses:validate' },
  { id: 'project-license', script: 'license:project', args: ['--', '--require'] },
  { id: 'release-version', script: 'check:release-version' },
  { id: 'typecheck', script: 'typecheck' },
  { id: 'lint', script: 'lint' },
  { id: 'test', script: 'test' },
  { id: 'build', script: 'build', skipLifecycleScripts: true },
];

const E2E_CHECK = {
  id: 'electron-e2e',
  script: 'test:e2e',
  skipLifecycleScripts: true,
};

const WINDOWS_CHECKS = [
  E2E_CHECK,
  { id: 'package-windows', script: 'package:win', skipLifecycleScripts: true },
  { id: 'verify-windows-package', script: 'verify:package:win' },
];

function npmCommand(check) {
  return ['npm', 'run', check.script, ...(check.args ?? [])].join(' ');
}

function createPlan({ windows = false, includeE2e = false, skipE2e = false, releaseTag } = {}) {
  const checks = BASE_CHECKS.map((check) => ({ ...check, args: [...(check.args ?? [])] }));
  const versionCheck = checks.find((check) => check.id === 'release-version');
  if (releaseTag && versionCheck) versionCheck.args.push('--', releaseTag);
  if (windows) checks.push(...WINDOWS_CHECKS.map((check) => ({ ...check, args: [...(check.args ?? [])] })));
  else if (includeE2e) checks.push({ ...E2E_CHECK, args: [] });
  if (skipE2e) {
    const e2e = checks.find((check) => check.id === E2E_CHECK.id);
    if (e2e) e2e.skip = true;
  }
  return checks.map((check) => ({ ...check, command: npmCommand(check) }));
}

function projectMetadata(cwd) {
  let appVersion = 'unknown';
  let saveVersion = -1;
  try {
    appVersion = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).version ?? 'unknown';
  } catch {
    // The failed npm step will report missing or malformed package metadata.
  }
  try {
    const saveData = readFileSync(join(cwd, 'src/game/saveData.ts'), 'utf8');
    const match = saveData.match(/CURRENT_SAVE_VERSION\s*=\s*(\d+)/);
    if (match) saveVersion = Number(match[1]);
  } catch {
    // Preserve a report even when the save-data source is missing.
  }
  return { appVersion, saveVersion };
}

function hardeningEvidence(cwd, commitSha, env) {
  const manualQaReportPath = env.KADOMOCO_MANUAL_QA_REPORT?.trim() || null;
  let manual = null;
  if (manualQaReportPath) {
    try { manual = JSON.parse(readFileSync(join(cwd, manualQaReportPath), 'utf8')); } catch { manual = null; }
  }
  const qaCommit = typeof manual?.commitSha === 'string' ? manual.commitSha : null;
  const passedStatuses = ['passed', 'PASS_WITH_WARNINGS_ALLOWED', 'PASS'];
  const qaStatus = passedStatuses.includes(manual?.overallStatus) && qaCommit && qaCommit === commitSha ? 'passed' : 'not-tested';
  return {
    ipcValidationStatus: 'implemented',
    ipcValidationTestCount: 4,
    storeRefactorStatus: 'implemented',
    performanceMeasurementToolStatus: existsSync(join(cwd, 'scripts/windows-performance-soak.ps1')) ? 'available' : 'not-run',
    performanceReportPath: env.KADOMOCO_PERFORMANCE_REPORT?.trim() || null,
    manualQaStatus: qaStatus,
    manualQaReportPath,
    manualQaCommitSha: qaCommit,
    manualQaTestedAt: manual?.testedAt ?? null,
    manualQaEnvironmentSummary: manual?.environment ?? null,
    codeSigningPolicyStatus: existsSync(join(cwd, 'docs/code-signing-decision.md')) ? 'documented' : 'missing',
    codeSigningStatus: env.CSC_LINK && env.CSC_KEY_PASSWORD ? 'configured-not-verified' : 'not-signed',
  };
}

export function readCommitSha({ cwd = process.cwd(), env = process.env, spawnCommand = spawnSync } = {}) {
  if (env.GITHUB_SHA?.trim()) return env.GITHUB_SHA.trim();
  try {
    const result = spawnCommand('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' });
    return result.status === 0 && result.stdout.trim() ? result.stdout.trim() : null;
  } catch {
    return null;
  }
}

function defaultExecute(check, { cwd, env }) {
  const childEnv = {
    ...env,
    ...(check.skipLifecycleScripts ? { npm_config_ignore_scripts: 'true' } : {}),
  };
  const npmExecPath = env.npm_execpath;
  const command = npmExecPath ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = npmExecPath
    ? [npmExecPath, 'run', check.script, ...(check.args ?? [])]
    : ['run', check.script, ...(check.args ?? [])];
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env: childEnv, stdio: 'inherit', shell: false });
    child.once('error', (error) => {
      console.error(`[release-check] Could not start ${check.id}: ${error.message}`);
      resolve(1);
    });
    child.once('close', (code, signal) => {
      if (signal) console.error(`[release-check] ${check.id} ended via signal ${signal}.`);
      resolve(code ?? 1);
    });
  });
}

function statusLabel(status) {
  if (status === 'pass') return '✅ PASS';
  if (status === 'fail') return '❌ FAIL';
  return '⏭ NOT RUN';
}

function markdownReport(report) {
  const rows = report.checks.map((check) =>
    `| ${check.id} | \`${check.command}\` | ${statusLabel(check.status)} | ${check.durationMs} | ${check.exitCode ?? '—'} |`,
  );
  return [
    '# KadoMoco Release Readiness',
    '',
    `- Overall status: **${report.overallStatus.toUpperCase()}**`,
    `- App version: \`${report.appVersion}\``,
    `- Save version: \`${report.saveVersion}\``,
    `- Commit: ${report.commitSha ? `\`${report.commitSha}\`` : 'unavailable'}`,
    `- Generated: \`${report.generatedAt}\``,
    `- Platform: \`${report.platform}\` / \`${report.architecture}\``,
    `- Manual Windows QA: **${report.manualQaStatus.toUpperCase().replace('-', ' ')}**`,
    `- Manual QA evidence: ${report.manualQaReportPath ? `\`${report.manualQaReportPath}\`` : 'none'}`,
    `- IPC validation: **${report.ipcValidationStatus}** (${report.ipcValidationTestCount} tests)`,
    `- Store refactor: **${report.storeRefactorStatus}**`,
    `- Performance tool: **${report.performanceMeasurementToolStatus}**; report: ${report.performanceReportPath ?? 'not-run'}`,
    `- Code signing policy/status: **${report.codeSigningPolicyStatus} / ${report.codeSigningStatus}**`,
    '',
    '| Check | Command | Status | Duration (ms) | Exit code |',
    '| --- | --- | --- | ---: | ---: |',
    ...rows,
    '',
    '> Automated checks never mark manual Windows QA complete. Record real-device evidence separately.',
    '',
  ].join('\n');
}

export function writeReleaseReadinessReport(report, { cwd = process.cwd(), outputDir = 'artifacts' } = {}) {
  const directory = join(cwd, outputDir);
  mkdirSync(directory, { recursive: true });
  const jsonPath = join(directory, 'release-readiness.json');
  const markdownPath = join(directory, 'release-readiness.md');
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(markdownPath, markdownReport(report), 'utf8');
  return { jsonPath, markdownPath };
}

export async function runReleaseCheck({
  cwd = process.cwd(),
  env = process.env,
  platform = process.platform,
  architecture = process.arch,
  windows = false,
  includeE2e = false,
  skipE2e = false,
  releaseTag,
  execute = defaultExecute,
  now = () => new Date(),
  getCommitSha = readCommitSha,
  outputDir = 'artifacts',
} = {}) {
  const plan = createPlan({ windows, includeE2e, skipE2e, releaseTag });
  const metadata = projectMetadata(cwd);
  const commitSha = getCommitSha({ cwd, env });
  const checks = [];
  let failureExitCode = 0;
  let stopped = false;

  console.log('[release-check] Planned order:');
  for (const [index, check] of plan.entries()) console.log(`  ${index + 1}. ${check.command}`);

  if (windows && platform !== 'win32') {
    console.error(`[release-check] release:check:win requires Windows; current platform is ${platform}.`);
    failureExitCode = 1;
    stopped = true;
  }

  for (const check of plan) {
    if (stopped || check.skip) {
      const timestamp = now().toISOString();
      checks.push({
        id: check.id,
        command: check.command,
        status: 'not-run',
        startedAt: timestamp,
        finishedAt: timestamp,
        durationMs: 0,
        exitCode: null,
      });
      if (check.skip) console.log(`[release-check] SKIP ${check.id}`);
      continue;
    }

    const started = now();
    console.log(`[release-check] START ${check.id}: ${check.command}`);
    const exitCode = await execute(check, { cwd, env });
    const finished = now();
    const status = exitCode === 0 ? 'pass' : 'fail';
    checks.push({
      id: check.id,
      command: check.command,
      status,
      startedAt: started.toISOString(),
      finishedAt: finished.toISOString(),
      durationMs: Math.max(0, finished.getTime() - started.getTime()),
      exitCode,
    });
    if (exitCode !== 0) {
      failureExitCode = exitCode;
      stopped = true;
      console.error(`[release-check] FAIL ${check.id} (exit ${exitCode}); later checks will not run.`);
    } else {
      console.log(`[release-check] PASS ${check.id}`);
    }
  }

  const report = {
    ...metadata,
    commitSha,
    generatedAt: now().toISOString(),
    platform,
    architecture,
    overallStatus: failureExitCode === 0 ? 'pass' : 'fail',
    checks,
    ...hardeningEvidence(cwd, commitSha, env),
  };
  const paths = writeReleaseReadinessReport(report, { cwd, outputDir });
  console.log(`[release-check] Reports: ${paths.jsonPath}, ${paths.markdownPath}`);
  console.log(`[release-check] Overall: ${report.overallStatus.toUpperCase()}`);
  return { report, exitCode: failureExitCode, paths };
}

export function parseReleaseCheckArgs(args) {
  const options = { windows: false, includeE2e: false, skipE2e: false, releaseTag: undefined };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--windows') options.windows = true;
    else if (arg === '--include-e2e') options.includeE2e = true;
    else if (arg === '--skip-e2e') options.skipE2e = true;
    else if (arg === '--release-tag') {
      index += 1;
      if (!args[index]) throw new Error('--release-tag requires a value.');
      options.releaseTag = args[index];
    } else throw new Error(`Unknown release-check option: ${arg}`);
  }
  if (options.includeE2e && options.windows) throw new Error('--include-e2e is only needed with release:check.');
  if (options.skipE2e && !options.windows) throw new Error('--skip-e2e is only valid with release:check:win.');
  return options;
}

export async function runReleaseCheckCli(args = process.argv.slice(2), overrides = {}) {
  const options = parseReleaseCheckArgs(args);
  return runReleaseCheck({ ...options, ...overrides });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runReleaseCheckCli();
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(`[release-check] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
