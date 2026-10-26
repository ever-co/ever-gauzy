import { OAuth2TokenManager, TokenPayload } from './oauth-token-manager';

/**
 * Owner decision 6 (2026-10-22): when a user or employee is deactivated, mcp-auth revokes their existing
 * MCP tokens. Before, nothing was ever revoked for an account: a refused refresh left the token on record,
 * and re-activating the account brought every token back.
 *
 * As in `oauth-token-manager.refresh.spec.ts`, `jose` (ESM-only) is stubbed: tokens are "signed" into
 * opaque handles that verify back to their payload. The bookkeeping under test runs unmodified.
 */
describe('OAuth2TokenManager — revoking a user’s tokens', () => {
	const CLIENT_ID = 'client-1';

	let manager: OAuth2TokenManager;
	let payloads: Map<string, TokenPayload>;

	beforeEach(() => {
		manager = new OAuth2TokenManager('https://issuer.test', 'https://audience.test');
		payloads = new Map();
		(manager as any).signToken = jest.fn(async (payload: TokenPayload) => {
			const handle = `token-${payloads.size + 1}`;
			payloads.set(handle, payload);
			return handle;
		});
		(manager as any).verifyToken = jest.fn(async (token: string) => {
			const payload = payloads.get(token);
			if (!payload) throw new Error('invalid token');
			return payload;
		});
		(manager as any).securityLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
	});

	afterEach(() => {
		manager.destroy();
		jest.useRealTimers();
	});

	const signIn = async (userId: string) => {
		const pair = await manager.generateTokenPair(userId, CLIENT_ID, ['openid'], { includeRefreshToken: true });
		return { access: payloads.get(pair.accessToken)!, refresh: payloads.get(pair.refreshToken!)!, pair };
	};

	it('revokes every refresh token of the user, and only theirs', async () => {
		const first = await signIn('user-1');
		const second = await signIn('user-1');
		const other = await signIn('user-2');

		expect(manager.revokeUserTokens('user-1')).toBe(2);

		expect(manager.isTokenRevoked(first.refresh)).toBe(true);
		expect(manager.isTokenRevoked(second.refresh)).toBe(true);
		expect(manager.isTokenRevoked(other.refresh)).toBe(false);
		expect(await manager.refreshAccessToken(first.pair.refreshToken!, CLIENT_ID, async () => ({}))).toBeNull();
		expect(await manager.refreshAccessToken(other.pair.refreshToken!, CLIENT_ID, async () => ({}))).not.toBeNull();
	});

	it('reports the access tokens issued until the revocation as revoked, and not the ones issued after', async () => {
		jest.useFakeTimers({ now: new Date('2026-10-23T10:00:00Z') });
		const before = await signIn('user-1');
		const other = await signIn('user-2');

		manager.revokeUserTokens('user-1');
		expect(manager.isTokenRevoked(before.access)).toBe(true);
		expect(manager.isTokenRevoked(other.access)).toBe(false);

		// The user signs in again later: the new tokens are good.
		jest.setSystemTime(new Date('2026-10-23T10:00:05Z'));
		const after = await signIn('user-1');
		expect(manager.isTokenRevoked(after.access)).toBe(false);
		expect(manager.isTokenRevoked(after.refresh)).toBe(false);
	});

	it('treats a token with no issue time as issued before the revocation', async () => {
		const { access } = await signIn('user-1');
		manager.revokeUserTokens('user-1');

		expect(manager.isTokenRevoked({ ...access, iat: undefined })).toBe(true);
	});

	it('reports a refresh token that is not on record as revoked', async () => {
		const { refresh } = await signIn('user-1');

		expect(manager.isTokenRevoked({ ...refresh, jti: 'unknown' })).toBe(true);
		expect(manager.isTokenRevoked(refresh)).toBe(false);
	});

	it('keeps the tokens revoked when the account is re-activated', async () => {
		const { pair } = await signIn('user-1');

		// Deactivated: the refresh is refused, and the tokens are revoked.
		expect(await manager.refreshAccessToken(pair.refreshToken!, CLIENT_ID, async () => null)).toBeNull();
		// Re-activated: the old refresh token stays dead.
		expect(await manager.refreshAccessToken(pair.refreshToken!, CLIENT_ID, async () => ({}))).toBeNull();
		expect(manager.isTokenRevoked(payloads.get(pair.accessToken)!)).toBe(true);
	});

	it('lists the holders of live refresh tokens once each, leaving out revoked and expired ones', async () => {
		await signIn('user-1');
		await signIn('user-1');
		await signIn('user-2');
		const expired = await signIn('user-3');
		(manager as any).refreshTokens.get(expired.refresh.jti).expiresAt = new Date(Date.now() - 1000);

		expect(manager.getRefreshTokenHolders().sort()).toEqual(['user-1', 'user-2']);

		manager.revokeUserTokens('user-2');
		expect(manager.getRefreshTokenHolders()).toEqual(['user-1']);
	});

	it('forgets a revocation once every access token issued before it has expired', async () => {
		jest.useFakeTimers({ now: new Date('2026-10-23T10:00:00Z') });
		const { access } = await signIn('user-1');
		manager.revokeUserTokens('user-1');

		jest.setSystemTime(new Date('2026-10-23T10:15:00Z'));
		(manager as any).cleanupExpiredTokens();
		expect(manager.isTokenRevoked(access)).toBe(true);

		jest.setSystemTime(new Date('2026-10-23T10:17:00Z'));
		(manager as any).cleanupExpiredTokens();
		expect((manager as any).userRevocations.has('user-1')).toBe(false);
	});
});
