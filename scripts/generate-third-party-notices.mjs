import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const rootPkg = JSON.parse(readFileSync('package.json','utf8'));
const lock = JSON.parse(readFileSync('package-lock.json','utf8'));
const pkgs = lock.packages ?? {};
const prodNames = new Set(Object.keys(rootPkg.dependencies ?? {}));
let changed = true;
while (changed) {
  changed = false;
  for (const [loc, meta] of Object.entries(pkgs)) {
    if (!loc.startsWith('node_modules/')) continue;
    const name = loc.replace('node_modules/','');
    if (!prodNames.has(name)) continue;
    for (const dep of Object.keys(meta.dependencies ?? {})) if (!prodNames.has(dep)) { prodNames.add(dep); changed = true; }
    for (const dep of Object.keys(meta.optionalDependencies ?? {})) if (pkgs[`node_modules/${dep}`] && !prodNames.has(dep)) { prodNames.add(dep); changed = true; }
  }
}
const rows = [];
const unknown = [];
for (const name of [...prodNames].sort((a,b)=>a.localeCompare(b))) {
  const loc = `node_modules/${name}`;
  const meta = pkgs[loc];
  if (!meta) continue;
  let pkgJson = {};
  const pkgPath = join(loc, 'package.json');
  if (existsSync(pkgPath)) pkgJson = JSON.parse(readFileSync(pkgPath,'utf8'));
  const license = meta.license ?? pkgJson.license ?? (Array.isArray(pkgJson.licenses) ? pkgJson.licenses.map(l => l.type ?? l).join(' OR ') : 'UNKNOWN');
  if (!license || license === 'UNKNOWN') unknown.push(name);
  rows.push({ name, version: meta.version ?? pkgJson.version ?? '', license, homepage: pkgJson.homepage ?? meta.resolved ?? '' });
}
const body = `# Third-Party Notices\n\nThis file is generated from \`package-lock.json\` and installed package metadata by \`npm run licenses:generate\`. It lists production dependency packages expected to be bundled with the app runtime. Development-only build tools are intentionally excluded.\n\n> Note: This notice does not choose or grant a distribution license for KadoMoco itself. The repository owner must decide the project license before v0.1.0 public distribution.\n\n| Package | Version | License | Source |\n| --- | --- | --- | --- |\n${rows.map(r => `| ${r.name} | ${r.version} | ${String(r.license).replaceAll('|','/')} | ${r.homepage || '-'} |`).join('\n')}\n`;
writeFileSync('THIRD_PARTY_NOTICES.md', body);
if (unknown.length) { console.warn(`Unknown licenses: ${unknown.join(', ')}`); process.exitCode = 1; }
console.log(`Wrote THIRD_PARTY_NOTICES.md with ${rows.length} production dependencies.`);
