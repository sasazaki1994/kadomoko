import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IpcValidationError,
  validateBoolean,
  validateSavePayload,
  validateSettings,
  validateWindowSize,
} from '../electron/ipcValidation';

function code(fn: () => unknown, expected: string) {
  assert.throws(fn, (error) => error instanceof IpcValidationError && error.code === expected);
}

test('accepts each supported setting and rejects unknown or malformed settings', () => {
  assert.deepEqual(validateSettings({ alwaysOnTop: true, volume: 0, statusDisplayMode: 'numbers', ambientFrequency: 'lively', bubbleFrequency: 'off', reduceActivityWhenFullscreen: false }), {
    alwaysOnTop: true, volume: 0, statusDisplayMode: 'numbers', ambientFrequency: 'lively', bubbleFrequency: 'off', reduceActivityWhenFullscreen: false,
  });
  code(() => validateSettings({ unknown: true }), 'UNSUPPORTED_SETTING');
  for (const volume of [-1, 101, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) code(() => validateSettings({ volume }), 'INVALID_ARGUMENT');
  code(() => validateSettings({ statusDisplayMode: 'graph' }), 'INVALID_ARGUMENT');
  code(() => validateSettings({ ambientFrequency: 'often' }), 'INVALID_ARGUMENT');
  code(() => validateSettings({ bubbleFrequency: true }), 'INVALID_ARGUMENT');
});

test('does not coerce booleans', () => {
  assert.equal(validateBoolean(false), false);
  code(() => validateBoolean('false'), 'INVALID_ARGUMENT');
  code(() => validateSettings({ alwaysOnTop: 1 }), 'INVALID_ARGUMENT');
});

test('accepts safe saves and rejects invalid versions and unsafe JSON values', () => {
  const pet = { name: 'moco', nested: [1, null, true] };
  assert.deepEqual(validateSavePayload(pet, 9), { pet, version: 9 });
  code(() => validateSavePayload(pet, 0), 'INVALID_SAVE_VERSION');
  code(() => validateSavePayload(pet, Number.NaN), 'INVALID_SAVE_VERSION');
  const circular: { self?: unknown } = {};
  circular.self = circular;
  code(() => validateSavePayload(circular, 9), 'INVALID_ARGUMENT');
  code(() => validateSavePayload({ value: BigInt(1) }, 9), 'INVALID_ARGUMENT');
  code(() => validateSavePayload({ value: () => undefined }, 9), 'INVALID_ARGUMENT');
  const polluted = {};
  Object.defineProperty(polluted, '__proto__', { value: {}, enumerable: true });
  code(() => validateSavePayload(polluted, 9), 'INVALID_ARGUMENT');
  code(() => validateSavePayload({ text: 'x'.repeat(1024 * 1024) }, 9), 'PAYLOAD_TOO_LARGE');
});

test('window dimensions use WINDOW_SPEC bounds and reject non-finite input', () => {
  assert.deepEqual(validateWindowSize(180, 240), { width: 180, height: 240 });
  for (const value of [119, 241, Number.NaN, Number.POSITIVE_INFINITY, '180', {}]) {
    code(() => validateWindowSize(value, 180), 'INVALID_ARGUMENT');
  }
});
