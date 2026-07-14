import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function normalizeStatus(value) {
  return value === undefined || value === '' ? 'not-recorded' : value;
}

export function createRcManifest({
  cwd = process.cwd(),
  releaseDir = join(cwd, 'release'),
  sourceRef = process.env.RC_SOURCE_REF ?? process.env.GITHUB_REF_NAME ?? null,
  commitSha = process.env.GITHUB_SHA ?? null,
  buildTimeUtc = new Date().toISOString(),
  artifactPattern = /^KadoMoco-.*\.(exe|zip)$/,
  env = process.env,
} = {}) {
  const packageJson = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
  const electronPackageJson = require('electron/package.json');
  const artifacts = existsSync(releaseDir)
    ? readdirSync(releaseDir).filter((file) => artifactPattern.test(file)).sort()
    : [];

  return {
    applicationName: packageJson.build?.productName ?? packageJson.name ?? null,
    version: packageJson.version ?? null,
    commitSha,
    sourceRef,
    buildTimeUtc,
    nodeVersion: process.version,
    electronVersion: electronPackageJson.version ?? null,
    platform: process.platform,
    architecture: process.arch,
    codeSigningStatus: normalizeStatus(env.RC_CODE_SIGNING_STATUS),
    spriteValidation: normalizeStatus(env.RC_SPRITE_VALIDATION),
    iconValidation: normalizeStatus(env.RC_ICON_VALIDATION),
    licenseNoticeValidation: normalizeStatus(env.RC_LICENSE_NOTICE_VALIDATION),
    unitTestStatus: normalizeStatus(env.RC_UNIT_TEST_STATUS),
    e2eStatus: normalizeStatus(env.RC_E2E_STATUS),
    packageVerificationStatus: normalizeStatus(env.RC_PACKAGE_VERIFICATION_STATUS),
    artifacts: artifacts.map((artifactName) => {
      const artifactPath = join(releaseDir, artifactName);
      return {
        artifactName,
        artifactSize: statSync(artifactPath).size,
        sha256: sha256File(artifactPath),
      };
    }),
  };
}

function isCliEntryPoint() {
  if (!process.argv[1]) return false;
  const invokedPath = realpathSync.native(resolve(process.argv[1]));
  const modulePath = realpathSync.native(fileURLToPath(import.meta.url));
  return process.platform === 'win32' ? invokedPath.toLowerCase() === modulePath.toLowerCase() : invokedPath === modulePath;
}

export function writeRcManifest(options = {}) {
  const manifest = createRcManifest(options);
  const outputPath = options.outputPath ?? join(options.releaseDir ?? join(options.cwd ?? process.cwd(), 'release'), 'rc-manifest.json');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

if (isCliEntryPoint()) {
  const outputArg = process.argv.indexOf('--output');
  writeRcManifest({ outputPath: outputArg >= 0 ? process.argv[outputArg + 1] : undefined });
}
