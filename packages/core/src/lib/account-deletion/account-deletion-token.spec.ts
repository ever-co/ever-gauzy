import {
	ACCOUNT_DELETION_DEFAULT_TTL_MINUTES,
	ACCOUNT_DELETION_MAX_TTL_MINUTES,
	ACCOUNT_DELETION_MIN_TTL_MINUTES,
	accountDeletionTtlMinutes,
	buildAccountDeletionLink,
	generateAccountDeletionToken,
	hashAccountDeletionEmail,
	hashAccountDeletionToken,
	isWellFormedAccountDeletionToken,
	maskAccountDeletionEmail
} from './account-deletion-token';

describe('account deletion token helpers', () => {
	it('generates 256-bit base64url tokens that never repeat', () => {
		const tokens = new Set(Array.from({ length: 200 }, () => generateAccountDeletionToken()));
		expect(tokens.size).toBe(200);
		for (const token of tokens) {
			expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
			expect(Buffer.from(token, 'base64url')).toHaveLength(32);
			expect(isWellFormedAccountDeletionToken(token)).toBe(true);
		}
	});

	it('stores a SHA-256 hex digest, never the token', () => {
		const token = generateAccountDeletionToken();
		const hash = hashAccountDeletionToken(token);
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
		expect(hash).not.toContain(token);
		expect(hashAccountDeletionToken(token)).toBe(hash);
	});

	it('rejects malformed tokens before any lookup', () => {
		for (const value of ['', 'short', 'x'.repeat(44), `${'a'.repeat(42)}=`, `${'a'.repeat(42)}.`, null, 42, {}]) {
			expect(isWellFormedAccountDeletionToken(value)).toBe(false);
		}
	});

	it('hashes addresses case- and whitespace-insensitively', () => {
		expect(hashAccountDeletionEmail(' Jane@Example.COM ')).toBe(hashAccountDeletionEmail('jane@example.com'));
	});

	it('puts the token in the fragment of a plain URL', () => {
		expect(buildAccountDeletionLink('https://app.ever.team/delete-account/confirm', 'abc')).toBe(
			'https://app.ever.team/delete-account/confirm#token=abc'
		);
	});

	it('keeps the token inside the fragment of a hash-routed URL', () => {
		expect(buildAccountDeletionLink('https://app.gauzy.co/#/auth/delete-account/confirm', 'abc')).toBe(
			'https://app.gauzy.co/#/auth/delete-account/confirm?token=abc'
		);
		expect(buildAccountDeletionLink('https://app.gauzy.co/#/auth/delete-account/confirm?lang=fr', 'abc')).toBe(
			'https://app.gauzy.co/#/auth/delete-account/confirm?lang=fr&token=abc'
		);
	});

	it('masks the address shown on the confirmation page', () => {
		expect(maskAccountDeletionEmail('Jane.Doe@Example.com')).toBe('j***@example.com');
		expect(maskAccountDeletionEmail('not-an-email')).toBe('***');
	});

	it('clamps the link lifetime', () => {
		expect(accountDeletionTtlMinutes({})).toBe(ACCOUNT_DELETION_DEFAULT_TTL_MINUTES);
		expect(accountDeletionTtlMinutes({ ACCOUNT_DELETION_TOKEN_TTL_MINUTES: 'abc' })).toBe(
			ACCOUNT_DELETION_DEFAULT_TTL_MINUTES
		);
		expect(accountDeletionTtlMinutes({ ACCOUNT_DELETION_TOKEN_TTL_MINUTES: '1' })).toBe(ACCOUNT_DELETION_MIN_TTL_MINUTES);
		expect(accountDeletionTtlMinutes({ ACCOUNT_DELETION_TOKEN_TTL_MINUTES: '600' })).toBe(
			ACCOUNT_DELETION_MAX_TTL_MINUTES
		);
		expect(accountDeletionTtlMinutes({ ACCOUNT_DELETION_TOKEN_TTL_MINUTES: '45' })).toBe(45);
	});
});
