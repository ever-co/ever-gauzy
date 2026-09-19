import { REDACTED_CREDENTIAL, redactKeyValueList, redactUrlCredentials } from './redact-credentials';

/**
 * The API used to print `REDIS_URL` - password included - to stdout at boot, where anyone with
 * `kubectl logs` access (and the log backend) could read it. These helpers are what the boot-time
 * log lines now go through, so every case below asserts two things: the secret is gone, AND the
 * diagnostic part (scheme, host, port, username, header names) is still there - a helper that
 * returned an empty string would pass the first check alone.
 */
describe('redactUrlCredentials', () => {
	const SECRET = 'S3cr3t-Valkey-Pass';

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
		const redacted = redactKeyValueList('authorization=Basic dXNlcjpwYXNz==');

		expect(redacted).not.toContain('dXNlcjpwYXNz');
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
