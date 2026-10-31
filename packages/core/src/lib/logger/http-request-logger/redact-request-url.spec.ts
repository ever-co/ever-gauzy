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
		'credentials',
		'state',
		'oauth_verifier',
		'code_verifier',
		'nonce',
		'ticket',
		'handoff'
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

	it('redacts what OAuth callbacks carry: code and state, oauth_token and oauth_verifier', () => {
		expect(redactRequestUrl('/api/integration/make/callback?code=c0de&state=st4te', { isSensitive })).toBe(
			'/api/integration/make/callback?code=[REDACTED]&state=[REDACTED]'
		);
		expect(
			redactRequestUrl('/api/integrations/upwork/callback?oauth_token=t0k&oauth_verifier=v3r', { isSensitive })
		).toBe('/api/integrations/upwork/callback?oauth_token=[REDACTED]&oauth_verifier=[REDACTED]');
	});

	it('redacts a JSON query value that holds a sensitive field or value, and keeps one that does not', () => {
		const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));
		const withEmail = json({ relations: ['tags'], findInput: { email: 'jane@example.com' } });
		const withToken = json([{ where: { accessToken: 'abc' } }]);
		const withEmailValue = json({ filter: ['jane@example.com'] });
		const harmless = json({ relations: ['tags'], findInput: { organizationId: '7c1e', name: 'Acme' } });

		expect(redactRequestUrl(`/api/contact?data=${withEmail}&page=1`, { isSensitive })).toBe(
			'/api/contact?data=[REDACTED]&page=1'
		);
		expect(redactRequestUrl(`/api/contact?data=${withToken}`, { isSensitive })).toBe(
			'/api/contact?data=[REDACTED]'
		);
		expect(redactRequestUrl(`/api/contact?data=${withEmailValue}`, { isSensitive })).toBe(
			'/api/contact?data=[REDACTED]'
		);
		expect(redactRequestUrl(`/api/contact?data=${harmless}`, { isSensitive })).toBe(
			`/api/contact?data=${harmless}`
		);
	});

	it('redacts a JSON-looking query value it cannot parse, and JSON nested too deep to check', () => {
		const deep = encodeURIComponent('['.repeat(40) + ']'.repeat(40));

		expect(redactRequestUrl('/api/contact?data=%7B%22email%22%3A%22jane', { isSensitive })).toBe(
			'/api/contact?data=[REDACTED]'
		);
		expect(redactRequestUrl(`/api/contact?data=${deep}`, { isSensitive })).toBe('/api/contact?data=[REDACTED]');
	});

	it('redacts a value that holds a JWT, such as a shared invoice link passed on as a redirect', () => {
		const jwt = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxIn0', 'c2ln'].join('.');

		expect(
			redactRequestUrl(`/api/auth/login?redirect=${encodeURIComponent(`/public/invoice/42/${jwt}`)}&page=1`, {
				isSensitive
			})
		).toBe('/api/auth/login?redirect=[REDACTED]&page=1');
	});

	it('redacts a URL query value with something to redact in it, and keeps one without', () => {
		const shared = encodeURIComponent('/shared-entity/token/0a1b2c3d');
		const oauthReturn = encodeURIComponent('https://app.example/callback#access_token=abc&expires_in=3600');
		const nested = encodeURIComponent(`/sign-in?next=${encodeURIComponent('/x?code=c0de')}`);
		const harmless = encodeURIComponent('https://app.example/pages/employees?page=2');

		expect(redactRequestUrl(`/api/auth/login?redirect=${shared}`, { isSensitive })).toBe(
			'/api/auth/login?redirect=[REDACTED]'
		);
		expect(redactRequestUrl(`/api/auth/login?returnUrl=${oauthReturn}`, { isSensitive })).toBe(
			'/api/auth/login?returnUrl=[REDACTED]'
		);
		expect(redactRequestUrl(`/api/auth/login?redirect=${nested}`, { isSensitive })).toBe(
			'/api/auth/login?redirect=[REDACTED]'
		);
		expect(redactRequestUrl(`/api/auth/login?redirect=${harmless}`, { isSensitive })).toBe(
			`/api/auth/login?redirect=${harmless}`
		);
	});

	it('redacts an email address wherever it appears', () => {
		expect(
			redactRequestUrl('/api/user/find/jane%40example.com?search=john%40example.org&page=1', { isSensitive })
		).toBe('/api/user/find/[REDACTED]?search=[REDACTED]&page=1');
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

	it('redacts the segment after a /token/ or /secret/ segment, before the route is known', () => {
		expect(redactRequestUrl('/api/shared-entity/token/0a1b2c3d', { isSensitive })).toBe(
			'/api/shared-entity/token/[REDACTED]'
		);
		expect(redactRequestUrl('/api/x/Secret/abc/def', { isSensitive })).toBe('/api/x/Secret/[REDACTED]/def');
		expect(redactRequestUrl('/api/x/token/', { isSensitive })).toBe('/api/x/token/');
	});

	it('keeps paths where such a word is only part of a segment, or is not a token keyword', () => {
		for (const url of ['/api/auth/login', '/api/auth/refresh-token/abc', '/api/subscription-plan/code/basic']) {
			expect(redactRequestUrl(url, { isSensitive })).toBe(url);
		}
	});

	describe('a long random-looking path segment', () => {
		// Built at run time: a long literal of this shape reads as a leaked secret to secret scanners.
		const opaque = 'a1b2c3d4'.repeat(4);

		it('is redacted when no route parameter accounts for it (not routed yet, or no route matched)', () => {
			expect(redactRequestUrl(`/api/public/invoice/42/${opaque}`, { isSensitive })).toBe(
				'/api/public/invoice/42/[REDACTED]'
			);
			expect(redactRequestUrl(`/api/public/invoice/42/${opaque}`, { isSensitive, params: {} })).toBe(
				'/api/public/invoice/42/[REDACTED]'
			);
		});

		it('is redacted when only a wildcard matched it, such as the middleware routes every request goes through', () => {
			expect(
				redactRequestUrl(`/api/public/invoice/42/${opaque}`, {
					isSensitive,
					params: { splat: ['public', 'invoice', '42', opaque] }
				})
			).toBe('/api/public/invoice/42/[REDACTED]');
		});

		it('is kept when a route parameter that is not sensitive matched it', () => {
			expect(redactRequestUrl(`/api/report/${opaque}`, { isSensitive, params: { slug: opaque } })).toBe(
				`/api/report/${opaque}`
			);
		});

		it('is told apart from ids, dates and words, which are kept', () => {
			for (const url of [
				'/api/employee/0b8f0e2c-8a2c-4c43-9a4e-1f1b2c3d4e5f',
				'/api/timesheet/statistics/2024-01-31',
				'/api/organization-projects-settings-overview',
				'/api/x/a1b2c3d4a1b2c3d4a1b2'
			]) {
				expect(redactRequestUrl(url, { isSensitive })).toBe(url);
			}
		});
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
