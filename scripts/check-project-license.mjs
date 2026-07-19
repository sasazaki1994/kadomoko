import { appendFileSync, existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const UNDECIDED = /license\s+(?:is\s+)?(?:not\s+decided|undecided|pending)|licen[cs]ing\s+(?:is\s+)?(?:not\s+decided|undecided|pending)|ライセンス(?:は|が|\s)*(?:未決定|未確定|検討中)/i;
const OPEN_SOURCE_LICENSE = /\bMIT License\b|Apache License|GNU (?:General Public License|GPL)/i;

export function checkProjectLicense({ cwd = process.cwd() } = {}) {
  const read = (file) => existsSync(join(cwd, file)) ? readFileSync(join(cwd, file), 'utf8') : '';
  const packageJson = JSON.parse(read('package.json') || '{}');
  const license = read('LICENSE');
  const readme = read('README.md');
  const notes = read('docs/release-notes-v0.1.0.md');
  const packageLicense = packageJson.license ?? null;
  const checks = {
    licenseExists: existsSync(join(cwd, 'LICENSE')),
    licenseAllRightsReserved: /All Rights Reserved/i.test(license),
    licenseCopyrightHolder: /sasazaki1994/i.test(license),
    licenseCopyrightYear: /2026/.test(license),
    licenseRejectsOpenSourceTerms: !OPEN_SOURCE_LICENSE.test(license),
    packagePrivate: packageJson.private === true,
    packageLicense: packageLicense === 'UNLICENSED',
    readmeProprietaryPolicy: /proprietary|All Rights Reserved/i.test(readme),
    releaseNotesProprietaryPolicy: /proprietary|All Rights Reserved/i.test(notes),
    readmeHasNoUndecidedLanguage: !UNDECIDED.test(readme),
    releaseNotesHaveNoUndecidedLanguage: !UNDECIDED.test(notes),
  };
  const decided = Object.values(checks).every(Boolean);
  return {
    ok: decided,
    status: decided ? 'decided' : 'invalid',
    policy: 'proprietary',
    packageLicense,
    copyrightHolder: 'sasazaki1994',
    copyrightYear: 2026,
    checks,
  };
}

function isCliEntryPoint() {
  if (!process.argv[1]) return false;
  const invokedPath = realpathSync.native(resolve(process.argv[1]));
  const modulePath = realpathSync.native(fileURLToPath(import.meta.url));
  return process.platform === 'win32' ? invokedPath.toLowerCase() === modulePath.toLowerCase() : invokedPath === modulePath;
}

if (isCliEntryPoint()) {
  const mode = process.argv.includes('--require') ? 'require' : 'warn';
  const result = checkProjectLicense();
  console.log(JSON.stringify({ mode, ...result }, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Project license check\n\n\`\`\`json\n${JSON.stringify({ mode, ...result }, null, 2)}\n\`\`\`\n`);
  }
  if (mode === 'require' && !result.ok) process.exit(1);
}
