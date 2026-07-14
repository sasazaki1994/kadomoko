import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
// Prefer an explicit CLI argument so pull_request refs such as "25/merge" do not
// break PR CI when the workflow intentionally checks the known release target.
const ref = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? `v${version}`;
const expected = `v${version}`;

assert.equal(ref, expected, `Release tag ${ref} must match package.json version ${expected}`);
console.log(`Release version check passed: ${ref}`);
