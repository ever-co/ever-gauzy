import { redactHeaders, redactQuery, redactUrl } from './sentry-request-redaction';

describe('redactHeaders', () => {
	it('keeps every header but replaces credentials', () => {
		expect(
			redactHeaders({
				authorization: 'Bearer secret',
				Cookie: 'connect.sid=s',
				'x-api-key': 'k',
				'tenant-id': 't1',
				'user-agent': 'ua'
			})
		).toEqual({
			authorization: '[Filtered]',
			Cookie: '[Filtered]',
			'x-api-key': '[Filtered]',
			'tenant-id': 't1',
			'user-agent': 'ua'
		});
	});

	it('redacts credential-bearing query values in the parsed query and in the URL, keeping the rest', () => {
		expect(
			redactQuery({ where: { organizationId: 'o1', token: 't' }, code: '123', take: '10', tags: ['a'] })
		).toEqual({
			where: { organizationId: 'o1', token: '[Filtered]' },
			code: '[Filtered]',
			take: '10',
			tags: ['a']
		});
		expect(redactUrl('/api/auth/confirm?email=a%40b.c&code=123456&refresh_token=r')).toBe(
			'/api/auth/confirm?email=a%40b.c&code=%5BFiltered%5D&refresh_token=%5BFiltered%5D'
		);
		expect(redactUrl('/api/tags?where%5BorganizationId%5D=o1')).toBe('/api/tags?where%5BorganizationId%5D=o1');
		expect(redactUrl('/api/tags')).toBe('/api/tags');
	});
});
