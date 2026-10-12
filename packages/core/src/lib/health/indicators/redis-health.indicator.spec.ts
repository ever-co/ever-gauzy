import { createClient } from 'redis';
import { captureBootLogs, REDIS_ENV_KEYS } from '../../core/testing/boot-logging/boot-log.fixtures';
import { RedisHealthIndicator } from './redis-health.indicator';

jest.mock('redis', () => ({ createClient: jest.fn() }));

/**
 * The health indicator starts its own Redis client at boot and used to print the full `REDIS_URL`,
 * password included, to stdout - where anyone with `kubectl logs` access could read it. The log
 * line is kept (operators use it to see which Redis the API talks to) but must now carry the host
 * and port only.
 */
describe('RedisHealthIndicator boot logging', () => {
	const SECRET = 'dummy-health-check-password';
	const logs = captureBootLogs(REDIS_ENV_KEYS);

	beforeEach(() => {
		(createClient as jest.Mock).mockReset().mockReturnValue({
			on: jest.fn().mockReturnThis(),
			connect: jest.fn().mockResolvedValue(undefined)
		});
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
		expect(logs.lines).toContain('REDIS_URL: redis://:***@192.168.1.174:6380');
		expect(logs.lines.join('\n')).not.toContain(SECRET);
	});

	it('never logs the password of a URL built from REDIS_HOST/REDIS_USER/REDIS_PASSWORD', async () => {
		process.env.REDIS_ENABLED = 'true';
		process.env.REDIS_HOST = 'cache.internal';
		process.env.REDIS_PORT = '6379';
		process.env.REDIS_USER = 'default';
		process.env.REDIS_PASSWORD = SECRET;

		await bootIndicator();

		expect((createClient as jest.Mock).mock.calls[0][0]).toMatchObject({ password: SECRET });
		expect(logs.lines).toContain('REDIS_URL: redis://default:***@cache.internal:6379');
		expect(logs.lines.join('\n')).not.toContain(SECRET);
	});

	it('never logs the password through the error path when REDIS_URL is malformed', async () => {
		process.env.REDIS_ENABLED = 'true';
		// A space in the host makes new URL() throw ERR_INVALID_URL, which carries the whole URL on error.input.
		process.env.REDIS_URL = `redis://:${SECRET}@bad host:6380`;

		await bootIndicator();

		expect(createClient).not.toHaveBeenCalled();
		// Control: the error really was logged, so the absence check below is meaningful.
		expect(logs.lines.some((line) => line.startsWith('Redis Health Connect Error:'))).toBe(true);
		expect(logs.lines.join('\n')).not.toContain(SECRET);
	});
});
