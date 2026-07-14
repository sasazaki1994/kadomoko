import { appendFileSync, existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function checkProjectLicense({ cwd = process.cwd() } = {}) {
  const read = (file) => existsSync(join(cwd, file)) ? readFileSync(join(cwd, file), 'utf8') : '';
  const packageJson = JSON.parse(read('package.json') || '{}');
  const readme = read('README.md');
  const notes = read('docs/release-notes-v0.1.0.md');
  const licenseExists = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'].some((file) => existsSync(join(cwd, file)));
  const packageLicense = packageJson.license ?? null;
  const readmeMentionsLicense = /license|ライセンス/i.test(readme);
  const releaseNotesMentionLicense = /license|ライセンス/i.test(notes);
  const decided = licenseExists && Boolean(packageLicense) && !/UNLICENSED|SEE LICENSE|not decided|未決定/i.test(String(packageLicense));
  const checks = { licenseExists, packageLicense, readmeMentionsLicense, releaseNotesMentionLicense, decided };
  return { ok: decided, status: decided ? 'decided' : 'undecided', checks };
}

function isCliEntryPoint() {
  if (!process.argv[1]) return false;
  const invokedPath = realpathSync.native(resolve(process.argv[1]));
  const modulePath = realpathSync.native(fileURLToPath(import.meta.url));
  return process.platform === 'win32' ? invokedPath.toLowerCase() === modulePath.toLowerCase() : invokedPath === modulePath;
}

function parseMode(argv) {
  if (argv.includes('--require')) return 'require';
  return 'warn';
}

if (isCliEntryPoint()) {
  const mode = parseMode(process.argv.slice(2));
  const result = checkProjectLicense();
  console.log(JSON.stringify({ mode, ...result }, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Project license check\n\n\`\`\`json\n${JSON.stringify({ mode, ...result }, null, 2)}\n\`\`\`\n`);
  }
  if (mode === 'require' && !result.ok) process.exit(1);
}
