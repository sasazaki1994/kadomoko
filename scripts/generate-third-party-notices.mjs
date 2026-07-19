import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const pkgs = lock.packages ?? {};

function packageNameFromLockPath(lockPath) {
  const packagePath = lockPath.split('node_modules/').at(-1);
  if (!packagePath) return null;
  const parts = packagePath.split('/');
  return parts[0]?.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

const packageEntries = Object.entries(pkgs)
  .filter(([loc, meta]) => loc.includes('node_modules/') && meta.dev !== true)
  .map(([loc, meta]) => ({ loc, meta, name: packageNameFromLockPath(loc) }))
  .filter((entry) => entry.name)
  .sort((a, b) => a.name.localeCompare(b.name) || a.loc.localeCompare(b.loc));

const rows = [];
const unknown = [];
for (const { loc, meta, name } of packageEntries) {
  let pkgJson = {};
  const pkgPath = join(loc, 'package.json');
  if (existsSync(pkgPath)) pkgJson = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const license = meta.license ?? pkgJson.license ?? (Array.isArray(pkgJson.licenses) ? pkgJson.licenses.map((l) => l.type ?? l).join(' OR ') : 'UNKNOWN');
  if (!license || license === 'UNKNOWN') unknown.push(name);
  rows.push({ name, version: meta.version ?? pkgJson.version ?? '', license, homepage: pkgJson.homepage ?? meta.resolved ?? '' });
}

const body = `# Third-Party Notices\n\nThis file is generated from \`package-lock.json\` and installed package metadata by \`npm run licenses:generate\`. It lists notices for production dependency packages expected to be bundled with the app runtime. Development-only build tools are intentionally excluded.\n\nKadoMoco itself is proprietary software and is not licensed under the licenses listed in this file. Those licenses apply only to their respective third-party components.\n\nSee \`LICENSE\` for the terms applicable to KadoMoco's original source code and assets.\n\n| Package | Version | License | Source |\n| --- | --- | --- | --- |\n${rows.map((r) => `| ${r.name} | ${r.version} | ${String(r.license).replaceAll('|', '/')} | ${r.homepage || '-'} |`).join('\n')}\n`;
writeFileSync('THIRD_PARTY_NOTICES.md', body);
if (unknown.length) { console.warn(`Unknown licenses: ${unknown.join(', ')}`); process.exitCode = 1; }
console.log(`Wrote THIRD_PARTY_NOTICES.md with ${rows.length} production dependencies.`);
