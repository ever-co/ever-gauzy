/**
 * Loads `.env` and `.env.local` into `process.env`, as a side effect of being imported.
 *
 * It must stay the FIRST import of `main.ts`. Imports are evaluated before the statements of a
 * module (the bundle hoists them), so a `loadEnv()` call placed between imports ran only after
 * `@gauzy/core` and `./plugin.config` had already read the environment: a switch written in
 * `.env.local` (for example `EVER_STATS_ENABLED=false`) was then ignored when the built API was
 * started with `node` directly. As the first import, this module runs before any other module of
 * the API reads `process.env`. `plugins.matrix.spec.ts` checks that it stays first.
 */
import { loadEnv } from './load-env';

console.log('Loading Environment Variables...');
loadEnv();
console.log('Environment Variables Loaded');
