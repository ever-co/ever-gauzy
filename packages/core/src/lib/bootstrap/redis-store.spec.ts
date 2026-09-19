import { createClient } from 'redis';
import { captureRedisBootLogs } from '../core/testing/boot-logging/redis-boot-log.fixtures';
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
	const SECRET = 'dummy-session-store-password';
	const logs = captureRedisBootLogs();

	beforeEach(() => {
		(createClient as jest.Mock).mockReset().mockReturnValue({
			on: jest.fn().mockReturnThis(),
			connect: jest.fn().mockResolvedValue(undefined),
			ping: jest.fn().mockResolvedValue('PONG')
		});
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
		expect(logs.lines).toContain('REDIS_URL:  redis://:***@192.168.1.174:6380');
		expect(logs.lines.join('\n')).not.toContain(SECRET);
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
		expect(logs.lines.some((line) => line.startsWith('Failed to initialize Redis session store:'))).toBe(true);
		expect(logs.lines.join('\n')).not.toContain(SECRET);
	});
});
