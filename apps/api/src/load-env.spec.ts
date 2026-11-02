import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ENV_LOCAL_NO_OVERRIDE, keptOverEnvLocal, loadEnv } from './load-env';

const NAMES = ['API_BASE_URL', 'CLIENT_BASE_URL', 'DB_TYPE', ENV_LOCAL_NO_OVERRIDE];

/**
 * Runs `loadEnv()` in a working directory holding `files`, starting from `start` for the variables in NAMES, and
 * returns what it left in those variables. The real environment is restored afterwards.
 */
function loadIn(files: Record<string, string>, start: Record<string, string>): Record<string, string | undefined> {
	const cwd = process.cwd();
	const saved = Object.fromEntries(NAMES.map((name) => [name, process.env[name]]));
	const dir = mkdtempSync(join(tmpdir(), 'gauzy-api-load-env-'));
	const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
	const time = jest.spyOn(console, 'time').mockImplementation(() => undefined);
	const timeEnd = jest.spyOn(console, 'timeEnd').mockImplementation(() => undefined);
	try {
		for (const [name, content] of Object.entries(files)) {
			writeFileSync(join(dir, name), content);
		}
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
		log.mockRestore();
		time.mockRestore();
		timeEnd.mockRestore();
		rmSync(dir, { recursive: true, force: true });
	}
}

const ENV_LOCAL = 'API_BASE_URL=http://localhost:3000\nCLIENT_BASE_URL=http://localhost:4200\nDB_TYPE=sqlite\n';
const FORWARDED = 'https://octo-fortnight-x7r-3000.app.github.dev';

describe('loadEnv: .env.local wins, except over the variables ENV_LOCAL_NO_OVERRIDE names', () => {
	it('control: .env.local overrides the environment and .env', () => {
		const env = loadIn({ '.env': 'DB_TYPE=postgres\n', '.env.local': ENV_LOCAL }, { API_BASE_URL: FORWARDED });
		expect(env.API_BASE_URL).toBe('http://localhost:3000');
		expect(env.DB_TYPE).toBe('sqlite');
	});

	it('keeps the starting value of a variable the list names, and only that one', () => {
		const env = loadIn(
			{ '.env.local': ENV_LOCAL },
			{ API_BASE_URL: FORWARDED, DB_TYPE: 'postgres', [ENV_LOCAL_NO_OVERRIDE]: 'API_BASE_URL' }
		);
		expect(env.API_BASE_URL).toBe(FORWARDED);
		expect(env.DB_TYPE).toBe('sqlite');
		expect(env.CLIENT_BASE_URL).toBe('http://localhost:4200');
	});

	it('lets .env.local set a listed variable the starting environment leaves unset', () => {
		const env = loadIn({ '.env.local': ENV_LOCAL }, { [ENV_LOCAL_NO_OVERRIDE]: 'API_BASE_URL,CLIENT_BASE_URL' });
		expect(env.API_BASE_URL).toBe('http://localhost:3000');
		expect(env.CLIENT_BASE_URL).toBe('http://localhost:4200');
	});

	it('does not keep a value that only .env set: .env.local still wins over it', () => {
		const env = loadIn(
			{ '.env': 'API_BASE_URL=https://from-dot-env.example.test\n', '.env.local': ENV_LOCAL },
			{ [ENV_LOCAL_NO_OVERRIDE]: 'API_BASE_URL' }
		);
		expect(env.API_BASE_URL).toBe('http://localhost:3000');
	});

	it('ignores a list written in .env.local', () => {
		const env = loadIn(
			{ '.env.local': `${ENV_LOCAL}${ENV_LOCAL_NO_OVERRIDE}=API_BASE_URL\n` },
			{ API_BASE_URL: FORWARDED }
		);
		expect(env.API_BASE_URL).toBe('http://localhost:3000');
	});
});

describe('keptOverEnvLocal', () => {
	it('reads a comma-separated list, tolerating spaces and empty entries', () => {
		expect(
			keptOverEnvLocal({
				[ENV_LOCAL_NO_OVERRIDE]: ' API_BASE_URL , ,CLIENT_BASE_URL,',
				API_BASE_URL: 'a',
				CLIENT_BASE_URL: ''
			})
		).toEqual({ API_BASE_URL: 'a', CLIENT_BASE_URL: '' });
	});

	it('keeps nothing without a list, or for names the environment does not set', () => {
		expect(keptOverEnvLocal({ API_BASE_URL: 'a' })).toEqual({});
		expect(keptOverEnvLocal({ [ENV_LOCAL_NO_OVERRIDE]: 'API_BASE_URL' })).toEqual({});
	});
});
