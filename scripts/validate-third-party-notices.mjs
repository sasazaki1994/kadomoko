import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const before = readFileSync('THIRD_PARTY_NOTICES.md','utf8');
execFileSync(process.execPath, ['scripts/generate-third-party-notices.mjs'], { stdio: 'inherit' });
const after = readFileSync('THIRD_PARTY_NOTICES.md','utf8');
assert.equal(after, before, 'THIRD_PARTY_NOTICES.md is not up to date; run npm run licenses:generate');
assert.ok(!after.includes('| UNKNOWN |'), 'THIRD_PARTY_NOTICES.md contains UNKNOWN licenses');
console.log('Third-party notices validation passed.');
