import { redactHeaders } from './sentry-request-redaction';

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
});
