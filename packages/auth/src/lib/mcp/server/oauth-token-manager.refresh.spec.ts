import { OAuth2TokenManager, TokenPayload } from './oauth-token-manager';

/**
 * Regression suite for GHSA-3cgp-wmrg-4fqg, MCP OAuth residual.
 *
 * The MCP OAuth server checks account status only at password login. A user deactivated after
 * signing in kept a 30-day refresh token, and the refresh_token grant re-minted access tokens from
 * the stored token metadata alone, so MCP tool access outlived the deactivation.
 *
 * `jose` is ESM-only and cannot be loaded by this Jest setup, so token signing and verification are
 * stubbed: the refresh token "verifies" to the payload of the pair the manager itself issued. The
 * logic under test — the metadata checks and the new account re-check — runs unmodified.
 */
describe('OAuth2TokenManager.refreshAccessToken — account re-check', () => {
	const CLIENT_ID = 'client-1';
	const USER_ID = 'user-1';

	let manager: OAuth2TokenManager;
	let payloads: Map<string, TokenPayload>;

	beforeEach(async () => {
		manager = new OAuth2TokenManager('https://issuer.test', 'https://audience.test');
		payloads = new Map();
		// Tokens are "signed" into opaque handles that verify back to their payload.
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
		// Keep the test output clean.
		(manager as any).securityLogger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
	});

	afterEach(() => manager.destroy());

	const issueRefreshToken = async (): Promise<string> => {
		const pair = await manager.generateTokenPair(USER_ID, CLIENT_ID, ['openid', 'profile'], {
			includeRefreshToken: true
		});
		return pair.refreshToken!;
	};

	it('CONTROL: without the account re-check, a deactivated user keeps minting access tokens', async () => {
		const refreshToken = await issueRefreshToken();
		// The pre-fix call shape: no user resolver is consulted at all.
		const pair = await manager.refreshAccessToken(refreshToken, CLIENT_ID);

		expect(pair?.accessToken).toBeDefined();
	});

	it('positive control: an active user still refreshes', async () => {
		const refreshToken = await issueRefreshToken();
		const resolveUser = jest.fn(async (userId: string) => ({ sub: userId }));

		const pair = await manager.refreshAccessToken(refreshToken, CLIENT_ID, resolveUser);

		expect(resolveUser).toHaveBeenCalledWith(USER_ID);
		expect(pair?.accessToken).toBeDefined();
		// And again: the refresh token was not consumed or revoked.
		expect(await manager.refreshAccessToken(refreshToken, CLIENT_ID, resolveUser)).not.toBeNull();
	});

	it('refuses when the user no longer resolves (inactive/archived), without revoking the token', async () => {
		const refreshToken = await issueRefreshToken();
		const jti = payloads.get(refreshToken)!.jti;

		expect(await manager.refreshAccessToken(refreshToken, CLIENT_ID, async () => null)).toBeNull();

		// NOT revoked: the wired provider (apps/mcp-auth getMcpUserInfo) also answers null for a
		// transient lookup failure, so revoking here would let one database blip sign an active user
		// out for good. Refusing is what blocks the deactivated account, and it holds on every call.
		expect((manager as any).refreshTokens.get(jti).isRevoked).toBe(false);
		expect(await manager.refreshAccessToken(refreshToken, CLIENT_ID, async () => null)).toBeNull();

		// Reactivating the account makes the same refresh token usable again, which is the point.
		expect(await manager.refreshAccessToken(refreshToken, CLIENT_ID, async () => ({ sub: USER_ID }))).not.toBeNull();
	});

	it('refuses without revoking when the lookup itself fails (transient error)', async () => {
		const refreshToken = await issueRefreshToken();
		const jti = payloads.get(refreshToken)!.jti;

		const pair = await manager.refreshAccessToken(refreshToken, CLIENT_ID, async () => {
			throw new Error('database unavailable');
		});

		expect(pair).toBeNull();
		expect((manager as any).refreshTokens.get(jti).isRevoked).toBe(false);
	});

	it('does not consult the user for a token that fails the existing checks', async () => {
		const refreshToken = await issueRefreshToken();
		const resolveUser = jest.fn(async () => ({ sub: USER_ID }));

		expect(await manager.refreshAccessToken(refreshToken, 'other-client', resolveUser)).toBeNull();
		expect(resolveUser).not.toHaveBeenCalled();
	});
});
