import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ENV_LOCAL_NO_OVERRIDE, keptOverEnvLocal, loadEnv } from './load-env';

const NAMES = ['API_BASE_URL', 'DB_TYPE', ENV_LOCAL_NO_OVERRIDE];

/** Runs `loadEnv()` in a working directory holding `.env.local`, from `start`, and restores the environment. */
function loadIn(envLocal: string, start: Record<string, string>): Record<string, string | undefined> {
	const cwd = process.cwd();
	const saved = Object.fromEntries(NAMES.map((name) => [name, process.env[name]]));
	const dir = mkdtempSync(join(tmpdir(), 'gauzy-worker-load-env-'));
	try {
		writeFileSync(join(dir, '.env.local'), envLocal);
		for (const name of NAMES) {
			delete process.env[name];
		}
		Object.assign(process.env, start);
		process.chdir(dir);
		loadEnv();
		return Object.fromEntries(NAMES.map((name) => [name, process.env[name]]));
	} finally {
		process.chdir(cwd);
		for (const [name, value] of Object.entries(saved)) {
			if (value === undefined) {
				delete process.env[name];
			} else {
				process.env[name] = value;
			}
		}
		rmSync(dir, { recursive: true, force: true });
	}
}

const ENV_LOCAL = 'API_BASE_URL=http://localhost:3000\nDB_TYPE=sqlite\n';
const FORWARDED = 'https://octo-fortnight-x7r-3000.app.github.dev';

describe('worker loadEnv: .env.local wins, except over the variables ENV_LOCAL_NO_OVERRIDE names', () => {
	it('control: .env.local overrides the environment', () => {
		expect(loadIn(ENV_LOCAL, { API_BASE_URL: FORWARDED }).API_BASE_URL).toBe('http://localhost:3000');
	});

	it('keeps the starting value of a listed variable, and only that one', () => {
		const env = loadIn(ENV_LOCAL, {
			API_BASE_URL: FORWARDED,
			DB_TYPE: 'postgres',
			[ENV_LOCAL_NO_OVERRIDE]: 'API_BASE_URL'
		});
		expect(env.API_BASE_URL).toBe(FORWARDED);
		expect(env.DB_TYPE).toBe('sqlite');
	});

	it('reads the list as the API does', () => {
		expect(keptOverEnvLocal({ [ENV_LOCAL_NO_OVERRIDE]: ' API_BASE_URL , ', API_BASE_URL: 'a' })).toEqual({
			API_BASE_URL: 'a'
		});
		expect(keptOverEnvLocal({ API_BASE_URL: 'a' })).toEqual({});
	});
});
