import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Marks `dist/esm` as ES modules.
 *
 * This package is dual-build: the API is CommonJS and needs `dist/cjs`, while Vite needs
 * real ESM so it can statically see the named exports (`ROLES`, `isApiError`, …). Without
 * this marker Node and Vite read `dist/esm/*.js` as CommonJS, because the package itself
 * has no `"type": "module"` — and the named imports fail at runtime even though the types
 * resolve perfectly, which is a confusing way to find out.
 */
const here = dirname(fileURLToPath(import.meta.url));
const esmDir = join(here, '..', 'dist', 'esm');

await mkdir(esmDir, { recursive: true });
await writeFile(join(esmDir, 'package.json'), `${JSON.stringify({ type: 'module' }, null, 2)}\n`, 'utf8');
