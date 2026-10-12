import { inspect } from 'util';
import {
	REDACTED_CREDENTIAL,
	redactHeaderValues,
	redactKeyValueList,
	redactUrlCredentials,
	redactUrlErrorInput
} from './redact-credentials';

/**
 * The API used to print `REDIS_URL` - password included - to stdout at boot, where anyone with
 * `kubectl logs` access (and the log backend) could read it. These helpers are what the boot-time
 * log lines now go through, so every case below asserts two things: the secret is gone, AND the
 * diagnostic part (scheme, host, port, username, header names) is still there - a helper that
 * returned an empty string would pass the first check alone.
 */
describe('redactUrlCredentials', () => {
	const SECRET = 'dummy-redis-password';

	it('redacts a password-only userinfo (the REDIS_URL shape used in production)', () => {
		const url = `redis://:${SECRET}@192.168.1.174:6380`;
		const redacted = redactUrlCredentials(url);

		expect(redacted).not.toContain(SECRET);
		expect(redacted).toBe(`redis://:${REDACTED_CREDENTIAL}@192.168.1.174:6380`);
	});

	it('keeps the username, scheme, database index and query, and redacts only the password', () => {
		const redacted = redactUrlCredentials(`rediss://default:${SECRET}@cache.internal:6380/2?family=4`);

		expect(redacted).not.toContain(SECRET);
		expect(redacted).toBe(`rediss://default:${REDACTED_CREDENTIAL}@cache.internal:6380/2?family=4`);
	});

	it('treats a userinfo without a colon as a bare token and redacts all of it', () => {
		const redacted = redactUrlCredentials(`https://${SECRET}@github.com/ever-co/ever-gauzy.git`);

		expect(redacted).not.toContain(SECRET);
		expect(redacted).toBe(`https://${REDACTED_CREDENTIAL}@github.com/ever-co/ever-gauzy.git`);
	});

	it.each([
		['an unencoded @', 'p@ss@word'],
		['an unencoded /', 'pa/ss+wo=rd'],
		['an unencoded #', 'pa#ss'],
		['an unencoded ?', 'pa?ss'],
		['a colon', 'pa:ss:word']
	])('does not leak any part of a password containing %s', (_label, password) => {
		const redacted = redactUrlCredentials(`redis://user:${password}@10.0.0.5:6379`);

		for (const fragment of password.split(/[@/#?:+=]/).filter((part) => part.length > 1)) {
			expect(redacted).not.toContain(fragment);
		}
		expect(redacted).toBe(`redis://user:${REDACTED_CREDENTIAL}@10.0.0.5:6379`);
	});

	it('redacts a connection string that has no scheme', () => {
		const redacted = redactUrlCredentials(`user:${SECRET}@10.0.0.5:6379`);

		expect(redacted).not.toContain(SECRET);
		expect(redacted).toBe(`user:${REDACTED_CREDENTIAL}@10.0.0.5:6379`);
	});

	it('returns a URL without credentials unchanged', () => {
		expect(redactUrlCredentials('redis://192.168.1.174:6380')).toBe('redis://192.168.1.174:6380');
		expect(redactUrlCredentials('http://localhost:14268/api/traces')).toBe('http://localhost:14268/api/traces');
	});

	it('returns an empty string for a missing value', () => {
		expect(redactUrlCredentials(undefined)).toBe('');
		expect(redactUrlCredentials(null)).toBe('');
		expect(redactUrlCredentials('')).toBe('');
	});
});

describe('redactKeyValueList', () => {
	it('keeps the header names and redacts every value', () => {
		const redacted = redactKeyValueList('signoz-access-token=abc123secret, x-honeycomb-team=def456secret');

		expect(redacted).not.toContain('abc123secret');
		expect(redacted).not.toContain('def456secret');
		expect(redacted).toBe(`signoz-access-token=${REDACTED_CREDENTIAL},x-honeycomb-team=${REDACTED_CREDENTIAL}`);
	});

	it('redacts a value that itself contains "="', () => {
		const redacted = redactKeyValueList('authorization=Basic token-value==');

		expect(redacted).not.toContain('token-value');
		expect(redacted).toBe(`authorization=${REDACTED_CREDENTIAL}`);
	});

	it('redacts an entry without "=" entirely, since it may be a bare secret', () => {
		expect(redactKeyValueList('bare-secret-token')).toBe(REDACTED_CREDENTIAL);
	});

	it('returns an empty string for a missing value', () => {
		expect(redactKeyValueList(undefined)).toBe('');
		expect(redactKeyValueList(null)).toBe('');
		expect(redactKeyValueList('')).toBe('');
	});
});

describe('redactUrlErrorInput', () => {
	const SECRET = 'dummy-redis-password';

	/** A real ERR_INVALID_URL, as thrown by `new URL()` (and by the Redis client) for a malformed REDIS_URL. */
	const invalidUrlError = (): Error => {
		try {
			new URL(`redis://:${SECRET}@bad host:6380`);
		} catch (error) {
			return error as Error;
		}
		throw new Error('expected new URL() to throw for a host containing a space');
	};

	it('removes the password Node stores on ERR_INVALID_URL.input, keeping the error and the host', () => {
		const error = invalidUrlError();
		// Control: the original error really does carry the secret when printed.
		expect(inspect(error)).toContain(SECRET);

		const redacted = redactUrlErrorInput(error);

		expect(redacted).toBe(error);
		expect(inspect(redacted)).not.toContain(SECRET);
		expect((redacted as Error & { input: string }).input).toBe(`redis://:${REDACTED_CREDENTIAL}@bad host:6380`);
	});

	it('also redacts a copy of the URL in the message and stack', () => {
		const error = Object.assign(new Error(`Invalid URL: redis://:${SECRET}@host:6380`), {
			input: `redis://:${SECRET}@host:6380`
		});

		const redacted = redactUrlErrorInput(error);

		expect(redacted.message).toBe(`Invalid URL: redis://:${REDACTED_CREDENTIAL}@host:6380`);
		expect(redacted.stack).not.toContain(SECRET);
		expect(inspect(redacted)).not.toContain(SECRET);
	});

	it('replaces an error that cannot be redacted in place with a redacted summary', () => {
		const error = Object.freeze(Object.assign(new Error('Invalid URL'), { input: `redis://:${SECRET}@host:6380` }));

		const redacted = redactUrlErrorInput(error);

		expect(inspect(redacted)).not.toContain(SECRET);
		expect(redacted.message).toBe(`URL parsing failed for redis://:${REDACTED_CREDENTIAL}@host:6380`);
	});

	it('never returns a partially redacted error when only some fields can be rewritten', () => {
		// `input` is writable, but a copy of the URL sits in a read-only `message`.
		const error = Object.assign(new Error('placeholder'), { input: `redis://:${SECRET}@host:6380` });
		Object.defineProperty(error, 'message', {
			value: `Invalid URL: redis://:${SECRET}@host:6380`,
			writable: false
		});

		const redacted = redactUrlErrorInput(error);

		expect(redacted).not.toBe(error);
		expect(inspect(redacted)).not.toContain(SECRET);
		expect(redacted.message).toBe(`URL parsing failed for redis://:${REDACTED_CREDENTIAL}@host:6380`);
	});

	it('returns values without a string input untouched', () => {
		const plain = new Error('Connection is closed.');

		expect(redactUrlErrorInput(plain)).toBe(plain);
		expect(plain.message).toBe('Connection is closed.');
		expect(redactUrlErrorInput(undefined)).toBeUndefined();
		expect(redactUrlErrorInput('a string')).toBe('a string');
	});

	it('returns an error whose URL carries no credentials untouched', () => {
		const error = Object.assign(new Error('Invalid URL'), { input: 'redis://bad host:6380' });

		expect(redactUrlErrorInput(error)).toBe(error);
		expect(error.input).toBe('redis://bad host:6380');
	});
});

describe('redactHeaderValues', () => {
	it('keeps the header names and redacts every value', () => {
		const redacted = redactHeaderValues({ Authorization: 'dummy-api-key', 'X-Team': 'dummy-team-key' });

		expect(redacted).toEqual({ Authorization: REDACTED_CREDENTIAL, 'X-Team': REDACTED_CREDENTIAL });
		expect(JSON.stringify(redacted)).not.toContain('dummy-');
	});

	it('returns undefined when there are no headers', () => {
		expect(redactHeaderValues(undefined)).toBeUndefined();
		expect(redactHeaderValues(null)).toBeUndefined();
	});
});
