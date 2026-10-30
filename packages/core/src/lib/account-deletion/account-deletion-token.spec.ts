import {
	ACCOUNT_DELETION_DEFAULT_TTL_MINUTES,
	ACCOUNT_DELETION_MAX_TTL_MINUTES,
	ACCOUNT_DELETION_MIN_TTL_MINUTES,
	accountDeletionEmailHashes,
	accountDeletionTtlMinutes,
	buildAccountDeletionLink,
	generateAccountDeletionToken,
	hashAccountDeletionEmail,
	hashAccountDeletionIp,
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

	describe('address and client-address digests are keyed with the deployment secret', () => {
		const sha256 = (value: string) => require('node:crypto').createHash('sha256').update(value, 'utf8').digest('hex');
		const withKey = { ENCRYPTION_KEY: 'a-deployment-encryption-key-1', JWT_SECRET: 'a-deployment-jwt-secret-2' };
		const jwtOnly = { JWT_SECRET: 'a-deployment-jwt-secret-2' };
		const noKey = {};

		beforeAll(() => jest.spyOn(console, 'warn').mockImplementation(() => undefined));
		afterAll(() => jest.restoreAllMocks());

		it('stores a keyed 64-hex digest of the address, never the unkeyed SHA-256 that a list of addresses matches', () => {
			const digest = hashAccountDeletionEmail('jane@example.com', withKey);

			expect(digest).toMatch(/^[0-9a-f]{64}$/);
			expect(digest).not.toBe(sha256('jane@example.com'));
			expect(hashAccountDeletionEmail(' Jane@Example.COM ', withKey)).toBe(digest);
			// Another deployment's secret gives another digest.
			expect(hashAccountDeletionEmail('jane@example.com', { ENCRYPTION_KEY: 'another-key' })).not.toBe(digest);
		});

		it('keys under JWT_SECRET when ENCRYPTION_KEY is not set, and falls back to the legacy digest with neither', () => {
			expect(hashAccountDeletionEmail('jane@example.com', jwtOnly)).toMatch(/^[0-9a-f]{64}$/);
			expect(hashAccountDeletionEmail('jane@example.com', jwtOnly)).not.toBe(sha256('jane@example.com'));
			expect(hashAccountDeletionEmail('jane@example.com', noKey)).toBe(sha256('jane@example.com'));
		});

		it('ignores a secret published in the repository', () => {
			expect(hashAccountDeletionEmail('jane@example.com', { JWT_SECRET: 'secretKey' })).toBe(sha256('jane@example.com'));
			expect(hashAccountDeletionIp('203.0.113.7', { JWT_SECRET: 'secretKey' })).toBeNull();
		});

		it('looks a stored request up by every digest it may carry: keyed under either secret, or the legacy one', () => {
			const hashes = accountDeletionEmailHashes('Jane@Example.com', withKey);

			expect(hashes[0]).toBe(hashAccountDeletionEmail('jane@example.com', withKey));
			expect(hashes).toContain(hashAccountDeletionEmail('jane@example.com', jwtOnly));
			expect(hashes).toContain(sha256('jane@example.com'));
			expect(new Set(hashes).size).toBe(hashes.length);
			expect(accountDeletionEmailHashes('jane@example.com', noKey)).toEqual([sha256('jane@example.com')]);
		});

		it('keys the client address, and records none rather than an unkeyed digest IPv4 can be enumerated from', () => {
			const digest = hashAccountDeletionIp('203.0.113.7', withKey);

			expect(digest).toMatch(/^[0-9a-f]{64}$/);
			expect(digest).not.toBe(sha256('203.0.113.7'));
			expect(hashAccountDeletionIp('203.0.113.7', noKey)).toBeNull();
			expect(hashAccountDeletionIp(null, withKey)).toBeNull();
		});
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
