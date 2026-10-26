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

/**
 * Size of libuv's threadpool, unless the environment sets one (UV_THREADPOOL_SIZE).
 *
 * Node's default is 4 threads, shared by every DNS lookup (each new connection to the database, Redis, object
 * storage or an analytics endpoint resolves its host there), the PBKDF2 of every new PostgreSQL connection's SCRAM
 * authentication, bcrypt (every sign-in hashes or compares a password for ~200 ms at the configured cost), and
 * file-system and zlib work. Four slow DNS answers — routine in Kubernetes, where a name is tried against several
 * search domains — or a burst of sign-ins occupy all four threads, and every operation that needs one, in any
 * request, queues behind them. The threads are created on first use, which is after this point: everything
 * before it runs synchronously.
 */
export const DEFAULT_UV_THREADPOOL_SIZE = 16;
if (!process.env.UV_THREADPOOL_SIZE) {
	process.env.UV_THREADPOOL_SIZE = String(DEFAULT_UV_THREADPOOL_SIZE);
}
