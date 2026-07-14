import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
// Prefer an explicit CLI argument so pull_request refs such as "25/merge" do not
// break PR CI when the workflow intentionally checks the known release target.
const explicitRef = process.argv[2];
const envRef = process.env.GITHUB_REF_NAME;
const ref = explicitRef ?? envRef;
const expected = `v${version}`;

if (!ref || (!explicitRef && !ref.startsWith('v'))) {
  console.log(`Release version check skipped for non-tag ref: ${ref ?? '(none)'}`);
} else {
  assert.equal(ref, expected, `Release tag ${ref} must match package.json version ${expected}`);
  console.log(`Release version check passed: ${ref}`);
}
