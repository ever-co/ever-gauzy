import { createSensitiveParameterMatcher, MAX_LOGGED_URL_LENGTH, redactRequestUrl } from './redact-request-url';

describe('createSensitiveParameterMatcher', () => {
	const isSensitive = createSensitiveParameterMatcher();

	it.each([
		'token',
		'access_token',
		'accessToken',
		'refreshToken',
		'X-Access-Token',
		'accesstoken',
		'password',
		'newPassword',
		'client_secret',
		'api_key',
		'apiKey',
		'x-api-key',
		'authorization',
		'auth',
		'sessionId',
		'cookie',
		'signature',
		'code',
		'otp',
		'email',
		'where[email]',
		'credentials'
	])('treats %p as sensitive', (name) => {
		expect(isSensitive(name)).toBe(true);
	});

	it.each(['page', 'limit', 'relations[0]', 'organizationId', 'tenantId', 'name', 'search', 'sort', 'author', 'id'])(
		'keeps %p',
		(name) => {
			expect(isSensitive(name)).toBe(false);
		}
	);

	it('adds the extra words it is given, case-insensitively', () => {
		const withExtras = createSensitiveParameterMatcher(['Phone']);

		expect(withExtras('phoneNumber')).toBe(true);
		expect(withExtras('token')).toBe(true);
		expect(isSensitive('phoneNumber')).toBe(false);
	});
});

describe('redactRequestUrl', () => {
	const isSensitive = createSensitiveParameterMatcher();

	it('keeps a URL without anything sensitive exactly as received', () => {
		const url = '/api/employee?relations%5B0%5D=user&page=2&organizationId=7c1e';
		expect(redactRequestUrl(url, { isSensitive })).toBe(url);
	});

	it('redacts the values of sensitive query parameters and keeps their names', () => {
		expect(
			redactRequestUrl('/api/auth/verify?token=abc123&email=jane%40example.com&page=1&access_token=xyz', {
				isSensitive
			})
		).toBe('/api/auth/verify?token=[REDACTED]&email=[REDACTED]&page=1&access_token=[REDACTED]');
	});

	it('reads an encoded parameter name before judging it', () => {
		expect(redactRequestUrl('/api/x?where%5Bpassword%5D=hunter2', { isSensitive })).toBe(
			'/api/x?where%5Bpassword%5D=[REDACTED]'
		);
	});

	it('redacts path segments holding the value of a sensitive route parameter', () => {
		expect(
			redactRequestUrl('/api/public/invoice/1f2e/s3cr3t-t0ken', {
				isSensitive,
				params: { id: '1f2e', token: 's3cr3t-t0ken' }
			})
		).toBe('/api/public/invoice/1f2e/[REDACTED]');
	});

	it('compares a route parameter with the decoded segment, as the router decoded it', () => {
		expect(
			redactRequestUrl('/api/shared-entity/token/a%2Bb%20c', { isSensitive, params: { token: 'a+b c' } })
		).toBe('/api/shared-entity/token/[REDACTED]');
	});

	it('ignores route parameters that are not strings (a wildcard match is an array)', () => {
		expect(redactRequestUrl('/api/files/a/b', { isSensitive, params: { splat: ['a', 'b'], key: undefined } })).toBe(
			'/api/files/a/b'
		);
	});

	it('redacts anything that looks like a JWT, whatever its name or place', () => {
		const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl';

		expect(redactRequestUrl(`/api/confirm/${jwt}?next=${jwt}&page=1`, { isSensitive })).toBe(
			'/api/confirm/[REDACTED]?next=[REDACTED]&page=1'
		);
		expect(redactRequestUrl(`/api/confirm?${jwt}`, { isSensitive })).toBe('/api/confirm?[REDACTED]');
	});

	it('keeps malformed percent-encoding as it is instead of throwing', () => {
		expect(redactRequestUrl('/api/x/%E0%A4%A?q=%ZZ&token=%E0%A4%A', { isSensitive })).toBe(
			'/api/x/%E0%A4%A?q=%ZZ&token=[REDACTED]'
		);
	});

	it('never decodes what it writes, so an encoded newline stays encoded', () => {
		expect(redactRequestUrl('/api/x?q=a%0AINJECTED', { isSensitive })).toBe('/api/x?q=a%0AINJECTED');
	});

	it('cuts an oversized URL', () => {
		const redacted = redactRequestUrl(`/api/x?q=${'a'.repeat(5000)}`, { isSensitive });

		expect(redacted).toHaveLength(MAX_LOGGED_URL_LENGTH + 1);
		expect(redacted.endsWith('…')).toBe(true);
	});
});
