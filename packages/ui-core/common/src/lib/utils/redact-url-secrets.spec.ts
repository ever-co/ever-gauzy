import { hasUrlSecrets, redactUrlSecrets } from './redact-url-secrets';

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

	// The router decodes a parameter's name, so a `token` with a percent-encoded letter reaches the page as
	// `token`: it is redacted as one.
	it('redacts a parameter whose name is percent-encoded, in the fragment and in the query', () => {
		expect(redactUrlSecrets('https://app.gauzy.co/#/auth/delete-account/confirm?%74oken=SECRET')).toBe(
			'https://app.gauzy.co/#/auth/delete-account/confirm?%74oken=[redacted]'
		);
		expect(redactUrlSecrets('https://x.test/a?%43%4F%44%45=123456&next=1')).toBe(
			'https://x.test/a?%43%4F%44%45=[redacted]&next=1'
		);
	});

	it("redacts a token written inside another parameter's value", () => {
		expect(redactUrlSecrets('https://x.test/#/login?next=/confirm?token=abc&x=1')).toBe(
			'https://x.test/#/login?next=/confirm?token=[redacted]&x=1'
		);
	});

	it('redacts the whole value of a secret, a `?` in it included', () => {
		expect(redactUrlSecrets('https://x.test/#/auth/reset?token=abc?part=def&next=1')).toBe(
			'https://x.test/#/auth/reset?token=[redacted]&next=1'
		);
	});

	it('keeps a parameter whose name cannot be decoded, and whose raw name is no secret', () => {
		expect(redactUrlSecrets('https://x.test/a?%E0%A4%A=1&code=2')).toBe(
			'https://x.test/a?%E0%A4%A=1&code=[redacted]'
		);
	});

	it('says whether a URL carries a secret, by the same reading', () => {
		expect(hasUrlSecrets('https://app.gauzy.co/#/auth/delete-account/confirm?%74oken=SECRET')).toBe(true);
		expect(hasUrlSecrets('https://x.test/a?Code=')).toBe(true);
		expect(hasUrlSecrets('https://x.test/tokens?q=1')).toBe(false);
		expect(hasUrlSecrets(undefined)).toBe(false);
	});

	it('leaves non-strings and clean URLs alone', () => {
		expect(redactUrlSecrets(undefined)).toBeUndefined();
		expect(redactUrlSecrets('https://x.test/tokens?q=1')).toBe('https://x.test/tokens?q=1');
	});
});
