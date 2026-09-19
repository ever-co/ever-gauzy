import { inspect } from 'util';
import { createClient } from 'redis';
import { RedisHealthIndicator } from './redis-health.indicator';

jest.mock('redis', () => ({ createClient: jest.fn() }));

/**
 * The health indicator starts its own Redis client at boot and used to print the full `REDIS_URL`,
 * password included, to stdout - where anyone with `kubectl logs` access could read it. The log
 * line is kept (operators use it to see which Redis the API talks to) but must now carry the host
 * and port only.
 */
describe('RedisHealthIndicator boot logging', () => {
	const SECRET = 'valkey-password-sentinel-7f3a91';
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
			connect: jest.fn().mockResolvedValue(undefined)
		});
	});

	afterEach(() => {
		spies.forEach((spy) => spy.mockRestore());
		REDIS_ENV_KEYS.forEach((key) =>
			savedEnv[key] === undefined ? delete process.env[key] : (process.env[key] = savedEnv[key])
		);
	});

	/** The constructor fires `startRedis()` without awaiting it; let it run to completion. */
	const bootIndicator = async () => {
		new RedisHealthIndicator();
		await new Promise((resolve) => setImmediate(resolve));
	};

	it('logs the Redis host and port from REDIS_URL but never its password', async () => {
		process.env.REDIS_ENABLED = 'true';
		process.env.REDIS_URL = `redis://:${SECRET}@192.168.1.174:6380`;

		await bootIndicator();

		// The client must still receive the real credential - only the log line is redacted.
		expect(createClient).toHaveBeenCalledTimes(1);
		expect((createClient as jest.Mock).mock.calls[0][0]).toMatchObject({ password: SECRET });

		// Control: the diagnostic line is still emitted, so the absence check below is meaningful.
		expect(output).toContain('REDIS_URL: redis://:***@192.168.1.174:6380');
		expect(output.join('\n')).not.toContain(SECRET);
	});

	it('never logs the password of a URL built from REDIS_HOST/REDIS_USER/REDIS_PASSWORD', async () => {
		process.env.REDIS_ENABLED = 'true';
		process.env.REDIS_HOST = 'cache.internal';
		process.env.REDIS_PORT = '6379';
		process.env.REDIS_USER = 'default';
		process.env.REDIS_PASSWORD = SECRET;

		await bootIndicator();

		expect((createClient as jest.Mock).mock.calls[0][0]).toMatchObject({ password: SECRET });
		expect(output).toContain('REDIS_URL: redis://default:***@cache.internal:6379');
		expect(output.join('\n')).not.toContain(SECRET);
	});
});
