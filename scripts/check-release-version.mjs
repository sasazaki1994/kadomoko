import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const EXPECTED_RELEASE_VERSION = '0.1.0';

function readRequired(cwd, file) {
  const path = join(cwd, file);
  assert.ok(existsSync(path), `${file} must exist.`);
  const content = readFileSync(path, 'utf8');
  assert.ok(content.trim(), `${file} must not be empty.`);
  return content;
}

function trackedGeneratedFiles(cwd, spawnCommand) {
  try {
    const result = spawnCommand('git', ['ls-files', '--', 'artifacts', 'build', 'src/assets/pet/pixel/kadomoco_sheet.png'], {
      cwd,
      encoding: 'utf8',
    });
    if (result.status !== 0) return null;
    return result.stdout.split(/\r?\n/).filter(Boolean);
  } catch {
    return null;
  }
}

export function checkReleaseConsistency({
  cwd = process.cwd(),
  releaseTag,
  spawnCommand = spawnSync,
} = {}) {
  const packageJson = JSON.parse(readRequired(cwd, 'package.json'));
  const version = packageJson.version;
  const expectedTag = `v${EXPECTED_RELEASE_VERSION}`;
  assert.equal(version, EXPECTED_RELEASE_VERSION, `package.json version must remain ${EXPECTED_RELEASE_VERSION}.`);
  if (releaseTag) assert.equal(releaseTag, expectedTag, `Release tag ${releaseTag} must match ${expectedTag}.`);

  const releaseNotes = readRequired(cwd, 'docs/release-notes-v0.1.0.md');
  const installGuide = readRequired(cwd, 'docs/install-and-uninstall.md');
  const changelog = readRequired(cwd, 'CHANGELOG.md');
  const license = readRequired(cwd, 'LICENSE');
  const credits = readRequired(cwd, 'CREDITS.md');
  const notices = readRequired(cwd, 'THIRD_PARTY_NOTICES.md');
  const readme = readRequired(cwd, 'README.md');
  const releaseWorkflow = readRequired(cwd, '.github/workflows/release.yml');
  const gitignore = readRequired(cwd, '.gitignore');
  const saveData = readRequired(cwd, 'src/game/saveData.ts');
  const spriteSpec = JSON.parse(readRequired(cwd, 'src/game/spriteSheetSpec.json'));
  const spriteSource = readRequired(cwd, 'assets/source/kadomoco-generated-magenta.png.base64');

  assert.match(releaseNotes, /KadoMoco v0\.1\.0 Release Notes/, 'Release notes must target v0.1.0.');
  assert.match(changelog, /\[0\.1\.0\]/, 'CHANGELOG.md must describe v0.1.0.');
  assert.match(license, /All Rights Reserved/i, 'LICENSE must preserve the proprietary policy.');
  assert.match(credits, /^# Credits/m, 'CREDITS.md must contain its heading.');
  assert.match(notices, /^# Third-Party Notices/m, 'THIRD_PARTY_NOTICES.md must contain its heading.');
  assert.doesNotMatch(notices, /\bUNKNOWN\b/, 'THIRD_PARTY_NOTICES.md must not contain unknown licenses.');
  assert.match(saveData, /CURRENT_SAVE_VERSION\s*=\s*9\b/, 'CURRENT_SAVE_VERSION must remain 9.');

  assert.equal(packageJson.build?.productName, 'KadoMoco', 'Windows productName must remain KadoMoco.');
  assert.equal(
    packageJson.build?.win?.artifactName,
    '${productName}-${version}-${arch}.${ext}',
    'Windows artifactName must remain KadoMoco-0.1.0-<arch>.<ext>.',
  );
  assert.equal(packageJson.build?.nsis?.deleteAppDataOnUninstall, false, 'Uninstall must keep save data.');

  assert.match(releaseWorkflow, /npm run release:check:win -- --release-tag \$env:RELEASE_TAG/, 'Draft Release must run the unified Windows gate with its tag.');
  assert.match(releaseWorkflow, /--draft/, 'Draft Release must remain a draft.');
  assert.match(releaseWorkflow, /docs\/release-notes-v0\.1\.0\.md/, 'Draft Release must use the v0.1.0 release notes.');
  assert.match(releaseWorkflow, /v0\.1\.0/, 'Draft Release workflow must document the expected v0.1.0 tag.');

  const safetyDocs = `${releaseNotes}\n${installGuide}`;
  assert.match(safetyDocs, /SmartScreen/i, 'SmartScreen behavior must be documented.');
  assert.match(safetyDocs, /not code-signed|before code signing|not configured/i, 'Unsigned v0.1.0 behavior must be documented.');
  assert.match(installGuide, /does not automatically delete saves|keeps app data on uninstall/i, 'Uninstall save retention must be documented.');

  assert.equal(spriteSpec.path, 'src/assets/pet/pixel/kadomoco_sheet.png', 'Sprite output path must remain generated PNG output.');
  assert.match(spriteSource.replace(/\s/g, ''), /^iVBOR/, 'Canonical sprite Base64 must contain a PNG payload.');
  assert.match(packageJson.scripts?.['prepare:sheet'] ?? '', /prepare-production-sprite-sheet\.mjs/, 'prepare:sheet must use the production generator.');
  assert.match(packageJson.scripts?.['prepare:assets'] ?? '', /prepare:sheet/, 'prepare:assets must regenerate the sprite.');
  assert.match(packageJson.scripts?.['prepare:assets'] ?? '', /validate:sprite:check/, 'prepare:assets must validate the sprite.');
  assert.match(packageJson.scripts?.['prepare:assets'] ?? '', /generate:icons:raw/, 'prepare:assets must regenerate icons.');
  assert.match(packageJson.scripts?.['prepare:assets'] ?? '', /validate:icons/, 'prepare:assets must validate icons.');
  assert.match(readme, /generated output|生成 PNG は直接編集せず|must not be edited directly/i, 'README must prohibit direct generated PNG edits.');
  assert.match(readme, /assets\/source\/kadomoco-generated-magenta\.png\.base64/, 'README must identify the canonical Base64 source.');
  for (const ignored of ['artifacts/', 'build/', 'src/assets/pet/pixel/kadomoco_sheet.png']) {
    assert.ok(gitignore.split(/\r?\n/).includes(ignored), `${ignored} must be ignored by Git.`);
  }
  const tracked = trackedGeneratedFiles(cwd, spawnCommand);
  if (tracked) assert.deepEqual(tracked, [], `Generated release assets must not be tracked: ${tracked.join(', ')}`);

  return {
    ok: true,
    version,
    expectedTag,
    releaseTag: releaseTag ?? null,
    gitTrackingChecked: tracked !== null,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const explicitRef = process.argv[2];
  const envRef = process.env.GITHUB_REF_NAME;
  const releaseTag = explicitRef ?? (envRef?.startsWith('v') ? envRef : undefined);
  try {
    const result = checkReleaseConsistency({ releaseTag });
    if (releaseTag) console.log(`Release version check passed: ${releaseTag}`);
    else console.log('Release consistency check passed for v0.1.0 (no tag supplied).');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Release consistency check failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
