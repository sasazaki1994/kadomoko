import { CURRENT_SAVE_VERSION } from '../src/game/saveData';
import { WINDOW_SPEC } from '../src/shared/windowSpec';

export type IpcValidationErrorCode =
  | 'INVALID_ARGUMENT'
  | 'UNSUPPORTED_SETTING'
  | 'PAYLOAD_TOO_LARGE'
  | 'INVALID_SAVE_VERSION';

export class IpcValidationError extends Error {
  constructor(public readonly code: IpcValidationErrorCode) {
    super(code);
    this.name = 'IpcValidationError';
  }
}

const MAX_SAVE_BYTES = 1024 * 1024;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const settingValidators = {
  alwaysOnTop: (value: unknown) => typeof value === 'boolean',
  volume: (value: unknown) => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 100,
  statusDisplayMode: (value: unknown) => ['numbers', 'observation', 'both'].includes(value as string),
  ambientFrequency: (value: unknown) => ['quiet', 'normal', 'lively'].includes(value as string),
  bubbleFrequency: (value: unknown) => ['off', 'quiet', 'normal'].includes(value as string),
  reduceActivityWhenFullscreen: (value: unknown) => typeof value === 'boolean',
} as const;

export type ValidatedSettings = Partial<{
  alwaysOnTop: boolean;
  volume: number;
  statusDisplayMode: 'numbers' | 'observation' | 'both';
  ambientFrequency: 'quiet' | 'normal' | 'lively';
  bubbleFrequency: 'off' | 'quiet' | 'normal';
  reduceActivityWhenFullscreen: boolean;
}>;

function inspectJsonValue(value: unknown, seen: Set<object>): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return;
    throw new IpcValidationError('INVALID_ARGUMENT');
  }
  if (typeof value !== 'object') throw new IpcValidationError('INVALID_ARGUMENT');
  if (seen.has(value)) throw new IpcValidationError('INVALID_ARGUMENT');
  seen.add(value);
  for (const symbol of Object.getOwnPropertySymbols(value)) {
    if (Object.prototype.propertyIsEnumerable.call(value, symbol)) throw new IpcValidationError('INVALID_ARGUMENT');
  }
  for (const key of Object.getOwnPropertyNames(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw new IpcValidationError('INVALID_ARGUMENT');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || descriptor.get || descriptor.set) throw new IpcValidationError('INVALID_ARGUMENT');
    inspectJsonValue(descriptor.value, seen);
  }
  seen.delete(value);
}

export function validateSavePayload(pet: unknown, version: unknown): { pet: object; version: number } {
  if (!pet || typeof pet !== 'object' || Array.isArray(pet)) throw new IpcValidationError('INVALID_ARGUMENT');
  if (!Number.isInteger(version) || (version as number) < 1 || (version as number) > CURRENT_SAVE_VERSION) {
    throw new IpcValidationError('INVALID_SAVE_VERSION');
  }
  inspectJsonValue(pet, new Set());
  const serialized = JSON.stringify(pet);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_SAVE_BYTES) throw new IpcValidationError('PAYLOAD_TOO_LARGE');
  return { pet, version: version as number };
}

export function validateSettings(value: unknown): ValidatedSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new IpcValidationError('INVALID_ARGUMENT');
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    if (!Object.prototype.hasOwnProperty.call(settingValidators, key)) throw new IpcValidationError('UNSUPPORTED_SETTING');
    const setting = (value as Record<string, unknown>)[key];
    if (!settingValidators[key as keyof typeof settingValidators](setting)) throw new IpcValidationError('INVALID_ARGUMENT');
    result[key] = setting;
  }
  return result as ValidatedSettings;
}

export function validateBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new IpcValidationError('INVALID_ARGUMENT');
  return value;
}

export function validateWindowSize(width: unknown, height: unknown): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height)) throw new IpcValidationError('INVALID_ARGUMENT');
  const w = Math.round(width as number);
  const h = Math.round(height as number);
  if (w < WINDOW_SPEC.minimum || w > WINDOW_SPEC.expanded || h < WINDOW_SPEC.minimum || h > WINDOW_SPEC.expanded) {
    throw new IpcValidationError('INVALID_ARGUMENT');
  }
  return { width: w, height: h };
}
