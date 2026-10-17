import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { apiCwd, apiDatabase, apiMain, apiPort, apiUrl, assertApiCwdOnBuildDrive, repoRoot, runDir } from './config';

/** `DESKTOP_E2E_DEMO=false` seeds only the default data (same accounts, minutes instead of the demo's random data). */
const demo = process.env['DESKTOP_E2E_DEMO'] !== 'false';

/** Startup + seed budget. The demo seed's random time logs alone take many minutes on a busy machine. */
const timeout = Number(process.env['DESKTOP_E2E_API_TIMEOUT_MINUTES'] || 60) * 60_000;

/**
 * Starts the built API on a fresh SQLite database and resolves once it is usable: with the demo seed,
 * only when the seed — which runs AFTER the server starts listening — has finished, because its long
 * SQLite write transactions would otherwise race the app's writes. Returns the function that stops it.
 *
 * It runs in a working directory of its own under the run directory: the demo seed empties
 * `<cwd>/apps/api/public/screenshots` and the screenshots the app uploads land under `<cwd>/apps/api/public`,
 * so neither touches the checkout. Its output goes to `<run dir>/api.log`.
 */
export async function startApi(): Promise<() => Promise<void>> {
	assertApiCwdOnBuildDrive();
	if (!existsSync(apiMain)) throw new Error(`API build not found at ${apiMain}: run \`yarn build:api\` first (see apps/desktop-e2e/README.md)`);
	mkdirSync(join(apiCwd, 'apps', 'api', 'public'), { recursive: true });
	// The API finds its assets (seed images, templates) at `<cwd>/dist/apps/api/assets`: link the build there.
	const buildLink = join(apiCwd, 'dist', 'apps', 'api');
	if (!existsSync(buildLink)) {
		mkdirSync(dirname(buildLink), { recursive: true });
		symlinkSync(dirname(apiMain), buildLink, 'junction');
	}
	const secret = () => randomBytes(32).toString('hex');
	const env: Record<string, string> = {
		...(process.env as Record<string, string>),
		NODE_ENV: 'development',
		DEMO: String(demo),
		DB_TYPE: 'better-sqlite3',
		DB_PATH: apiDatabase,
		API_HOST: '127.0.0.1',
		API_PORT: String(apiPort),
		PORT: String(apiPort),
		API_BASE_URL: apiUrl,
		// Throw-away secrets for this run: the API refuses to start without JWT_SECRET / JWT_REFRESH_TOKEN_SECRET.
		JWT_SECRET: secret(),
		JWT_REFRESH_TOKEN_SECRET: secret(),
		JWT_VERIFICATION_TOKEN_SECRET: secret(),
		EXPRESS_SESSION_SECRET: secret(),
		REDIS_ENABLED: 'false',
		WORKER_QUEUE_ENABLED: 'false',
		// When `dist` is a link to another drive, Node resolves main.js to its real path; this keeps the
		// workspace's node_modules reachable from there. Harmless otherwise.
		NODE_PATH: join(repoRoot, 'node_modules')
	};
	delete env['NODE_OPTIONS'];

	const log = createWriteStream(join(runDir, 'api.log'), { flags: 'a' });
	const child = spawn(process.execPath, ['--max-old-space-size=8192', apiMain], { cwd: apiCwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
	console.log(`[desktop-e2e] API pid ${child.pid} on ${apiUrl} (DEMO=${demo}), log ${join(runDir, 'api.log')}`);

	const stop = async () => {
		if (child.exitCode === null && child.signalCode === null) {
			try {
				if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
				else child.kill('SIGTERM');
			} catch {
				// already gone
			}
		}
		log.end();
	};

	const ready = new Promise<void>((resolve, reject) => {
		let listening = false;
		let tail = '';
		const onData = (chunk: Buffer) => {
			log.write(chunk);
			tail = (tail + chunk.toString()).slice(-4_000);
			if (!listening && tail.includes('Listening at http')) {
				listening = true;
				console.log('[desktop-e2e] API listening' + (demo ? '; waiting for the demo seed to finish' : ''));
				if (!demo) resolve();
			}
			if (demo && tail.includes('Demo environment seeded successfully')) resolve();
			if (tail.includes('Error seeding demo environment')) reject(new Error(`the demo seed failed (see ${join(runDir, 'api.log')})`));
		};
		child.stdout?.on('data', onData);
		child.stderr?.on('data', onData);
		child.on('exit', (code, signal) => reject(new Error(`the API exited (${code ?? signal}) before it was ready (see ${join(runDir, 'api.log')})`)));
	});
	let timer: NodeJS.Timeout | undefined;
	try {
		await Promise.race([
			ready,
			new Promise((_, reject) => {
				timer = setTimeout(() => reject(new Error(`the API was not ready within ${timeout / 60_000} min`)), timeout);
			})
		]);
	} catch (error) {
		await stop();
		throw error;
	} finally {
		clearTimeout(timer);
	}
	return stop;
}
