import type { SecretSignalDef, SecretSignalId } from '../types';

export const SECRET_SIGNAL_DEFS: Record<SecretSignalId, SecretSignalDef> = {
  tap_tap_pause: { id: 'tap_tap_pause', label: '短い間', description: '二度触れて少し待つ', windowMs: 2_500, cooldownMs: 20 * 60_000 },
  hello_corner: { id: 'hello_corner', label: 'ここにいる', description: '朝や復帰後の最初の合図', windowMs: 8 * 60_000, cooldownMs: 6 * 60 * 60_000 },
  quiet_check: { id: 'quiet_check', label: 'そっと確認', description: '状態を少しだけ見る', windowMs: 3_000, cooldownMs: 30 * 60_000 },
  sleepy_respect: { id: 'sleepy_respect', label: 'そっとする', description: '眠っている時に空間をあける', windowMs: 5_000, cooldownMs: 60 * 60_000 },
  look_and_wait: { id: 'look_and_wait', label: '見て待つ', description: '気になるものを急かさず待つ', windowMs: 7_000, cooldownMs: 30 * 60_000 },
  little_spin: { id: 'little_spin', label: '小さく回る', description: '機嫌のよい短い掛け合い', windowMs: 4_000, cooldownMs: 25 * 60_000 },
};

export const SECRET_SIGNAL_IDS = Object.keys(SECRET_SIGNAL_DEFS) as SecretSignalId[];
