import { SanitizerUtil } from './sanitizer.util';

/**
 * The sanitizer redacted a header only when it was exactly `authorization`, `cookie` or `api-key`, and a key only
 * when it was exactly `password`, `token`, `secret`, `credit_card` or `ssn`; the URL went out as it came. The tenant
 * `X-API-KEY`, a reset's `confirmPassword`, `refresh_token`, a sign-in `code` and every `?token=` reached PostHog.
 */
describe('SanitizerUtil', () => {
	it('redacts every credential-bearing header, the API key pair included', () => {
		expect(
			SanitizerUtil.sanitizeHeaders({
				Authorization: 'Bearer jwt-1',
				cookie: 's=1',
				'X-API-KEY': 'key-1',
				'x-auth-token': 'tok-1',
				'content-type': 'application/json',
				'x-app-id': 'app-1'
			})
		).toEqual({
			Authorization: '[REDACTED]',
			cookie: '[REDACTED]',
			'X-API-KEY': '[REDACTED]',
			'x-auth-token': '[REDACTED]',
			'content-type': 'application/json',
			'x-app-id': 'app-1'
		});
	});

	it('redacts secrets whatever the key is spelt like, at any depth', () => {
		expect(
			SanitizerUtil.sanitizeObject({
				email: 'ada@example.com',
				password: 'p-1',
				confirmPassword: 'p-1',
				newPassword: 'p-2',
				refresh_token: 'r-1',
				accessToken: 'a-1',
				id_token: 'i-1',
				clientSecret: 'c-1',
				api_key: 'k-1',
				code: '12345678',
				handoff: 'h-1',
				nested: [{ token: 't-1', name: 'kept' }],
				countryCode: 'FR'
			})
		).toEqual({
			email: 'ada@example.com',
			password: '[REDACTED]',
			confirmPassword: '[REDACTED]',
			newPassword: '[REDACTED]',
			refresh_token: '[REDACTED]',
			accessToken: '[REDACTED]',
			id_token: '[REDACTED]',
			clientSecret: '[REDACTED]',
			api_key: '[REDACTED]',
			code: '[REDACTED]',
			handoff: '[REDACTED]',
			nested: [{ token: '[REDACTED]', name: 'kept' }],
			countryCode: 'FR'
		});
	});

	it('redacts the credential headers of a header object it reaches, such as a WebSocket handshake', () => {
		expect(
			SanitizerUtil.sanitizeObject({
				headers: {
					authorization: 'Bearer jwt-1',
					Cookie: 's=1',
					'Proxy-Authorization': 'Basic b-1',
					host: 'api.example.com'
				}
			})
		).toEqual({
			headers: {
				authorization: '[REDACTED]',
				Cookie: '[REDACTED]',
				'Proxy-Authorization': '[REDACTED]',
				host: 'api.example.com'
			}
		});
	});

	it('redacts the query values of a URL that carry a credential, and keeps the rest', () => {
		expect(SanitizerUtil.sanitizeUrl('/api/integration/hubstaff/organizations?token=hub-1&page=2')).toBe(
			'/api/integration/hubstaff/organizations?token=%5BREDACTED%5D&page=2'
		);
		expect(SanitizerUtil.sanitizeUrl('https://app.example.com/reset?refresh_token=r-1#top')).toBe(
			'https://app.example.com/reset?refresh_token=%5BREDACTED%5D#top'
		);
		expect(SanitizerUtil.sanitizeUrl('/api/employee?page=2')).toBe('/api/employee?page=2');
		expect(SanitizerUtil.sanitizeUrl('/api/employee')).toBe('/api/employee');
		expect(SanitizerUtil.sanitizeUrl(undefined)).toBeUndefined();
	});
});
