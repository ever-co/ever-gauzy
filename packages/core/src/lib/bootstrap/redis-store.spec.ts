import { inspect } from 'util';
import { createClient } from 'redis';
import { configureRedisSession } from './redis-store';

jest.mock('redis', () => ({ createClient: jest.fn() }));
jest.mock('connect-redis', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('express-session', () => jest.fn(() => jest.fn()));
jest.mock('@gauzy/config', () => ({
	environment: { production: false, EXPRESS_SESSION_SECRET: 'test-session-secret' }
}));

/**
 * The session store used to print the full `REDIS_URL`, password included, to stdout at boot -
 * where anyone with `kubectl logs` access could read it. The line is kept for diagnostics but
 * must now carry the host and port only.
 */
describe('configureRedisSession boot logging', () => {
	const SECRET = 'redis-password-sentinel-2c9d44';
	const REDIS_ENV_KEYS = [
		'REDIS_ENABLED',
		'REDIS_URL',
		'REDIS_HOST',
		'REDIS_PORT',
		'REDIS_USER',
		'REDIS_PASSWORD',
		'REDIS_TLS'
	];

	let savedEnv: Record<string, string | undefined>;
	let output: string[];
	let spies: jest.SpyInstance[];

	beforeEach(() => {
		savedEnv = Object.fromEntries(REDIS_ENV_KEYS.map((key) => [key, process.env[key]]));
		REDIS_ENV_KEYS.forEach((key) => delete process.env[key]);

		output = [];
		spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
			jest.spyOn(console, method).mockImplementation((...args: unknown[]) => {
				output.push(args.map((arg) => (typeof arg === 'string' ? arg : inspect(arg, { depth: 5 }))).join(' '));
			})
		);

		(createClient as jest.Mock).mockReset().mockReturnValue({
			on: jest.fn().mockReturnThis(),
			connect: jest.fn().mockResolvedValue(undefined),
			ping: jest.fn().mockResolvedValue('PONG')
		});
	});

	afterEach(() => {
		spies.forEach((spy) => spy.mockRestore());
		REDIS_ENV_KEYS.forEach((key) =>
			savedEnv[key] === undefined ? delete process.env[key] : (process.env[key] = savedEnv[key])
		);
	});

	it('logs the Redis host and port from REDIS_URL but never its password', async () => {
		process.env.REDIS_ENABLED = 'true';
		process.env.REDIS_URL = `redis://:${SECRET}@192.168.1.174:6380`;
		const app = { use: jest.fn() };

		await configureRedisSession(app);

		// The client must still receive the real credential - only the log line is redacted.
		expect(createClient).toHaveBeenCalledTimes(1);
		expect((createClient as jest.Mock).mock.calls[0][0]).toMatchObject({ password: SECRET });
		expect(app.use).toHaveBeenCalledTimes(1);

		// Control: the diagnostic line is still emitted, so the absence check below is meaningful.
		expect(output).toContain('REDIS_URL:  redis://:***@192.168.1.174:6380');
		expect(output.join('\n')).not.toContain(SECRET);
	});

	it('never logs the password through the error path when REDIS_URL is malformed', async () => {
		process.env.REDIS_ENABLED = 'true';
		// A space in the host makes new URL() throw ERR_INVALID_URL, which carries the whole URL on error.input.
		process.env.REDIS_URL = `redis://:${SECRET}@bad host:6380`;
		const app = { use: jest.fn() };

		await configureRedisSession(app);

		// Falls back to the in-memory session store.
		expect(createClient).not.toHaveBeenCalled();
		expect(app.use).toHaveBeenCalledTimes(1);
		// Control: the error really was logged, so the absence check below is meaningful.
		expect(output.some((line) => line.startsWith('Failed to initialize Redis session store:'))).toBe(true);
		expect(output.join('\n')).not.toContain(SECRET);
	});
});
