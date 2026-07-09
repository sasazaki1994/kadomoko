import { rmSync } from 'node:fs';

rmSync(new URL('../.tmp-tests', import.meta.url), { force: true, recursive: true });
