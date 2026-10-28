import { redactUrlSecrets } from './redact-url-secrets';

describe('redactUrlSecrets', () => {
	it('redacts tokens in the fragment of hash-routed URLs', () => {
		expect(redactUrlSecrets('https://app.gauzy.co/#/auth/delete-account/confirm?token=abc_DEF-123')).toBe(
			'https://app.gauzy.co/#/auth/delete-account/confirm?token=[redacted]'
		);
	});

	it('redacts tokens and codes in the query and keeps the other parameters', () => {
		expect(redactUrlSecrets('https://x.test/a?email=a%40b.c&code=123456&next=%2F#token=zz')).toBe(
			'https://x.test/a?email=a%40b.c&code=[redacted]&next=%2F#token=[redacted]'
		);
	});

	it('leaves non-strings and clean URLs alone', () => {
		expect(redactUrlSecrets(undefined)).toBeUndefined();
		expect(redactUrlSecrets('https://x.test/tokens?q=1')).toBe('https://x.test/tokens?q=1');
	});
});
