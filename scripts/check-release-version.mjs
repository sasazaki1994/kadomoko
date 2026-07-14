import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const version = JSON.parse(readFileSync('package.json','utf8')).version;
const ref = process.env.GITHUB_REF_NAME ?? process.argv[2] ?? `v${version}`;
assert.equal(ref, `v${version}`, `Release tag ${ref} must match package.json version v${version}`);
console.log(`Release version check passed: ${ref}`);
