import { OAuth2TokenManager, TokenPayload, UserLookupUnavailableError } from './oauth-token-manager';

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

	/** The pre-fix call shape: two arguments, no account resolver. It no longer type-checks. */
	const refreshWithoutResolver = (token: string): Promise<any> =>
		(manager.refreshAccessToken as unknown as (t: string, c: string) => Promise<any>).call(
			manager,
			token,
			CLIENT_ID
		);

	it('CONTROL: the metadata-only path the pre-fix code took is otherwise valid (it minted a token)', async () => {
		const refreshToken = await issueRefreshToken();
		// Everything the pre-fix code checked still passes for this token, so the ONLY thing standing
		// between a deactivated user and a fresh access token is the account re-check below.
		const pair = await manager.refreshAccessToken(refreshToken, CLIENT_ID, async () => ({ sub: USER_ID }));

		expect(pair?.accessToken).toBeDefined();
	});

	it('fails closed when a caller omits the resolver, instead of skipping the account check', async () => {
		const refreshToken = await issueRefreshToken();

		// Not a token pair, and not `null` either: a misconfigured caller must not look like a bad
		// refresh token. The token endpoint turns this into 500 server_error.
		await expect(refreshWithoutResolver(refreshToken)).rejects.toThrow(/resolveUser/);
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

		// NOT revoked: refusing already blocks every use of the token, and a revocation could not be
		// undone if the account is re-activated. (A lookup that FAILS is a separate case now — the
		// provider rejects rather than answering null — and is covered below.)
		expect((manager as any).refreshTokens.get(jti).isRevoked).toBe(false);
		expect(await manager.refreshAccessToken(refreshToken, CLIENT_ID, async () => null)).toBeNull();

		// Reactivating the account makes the same refresh token usable again, which is the point.
		expect(await manager.refreshAccessToken(refreshToken, CLIENT_ID, async () => ({ sub: USER_ID }))).not.toBeNull();
	});

	it('reports a FAILED lookup separately from an inactive account, and keeps the token usable', async () => {
		const refreshToken = await issueRefreshToken();
		const jti = payloads.get(refreshToken)!.jti;
		const cause = new Error('database unavailable');

		// Not `null`: `null` becomes invalid_grant, which tells the client to throw a still-valid
		// refresh token away. A transient failure must stay retryable.
		await expect(
			manager.refreshAccessToken(refreshToken, CLIENT_ID, async () => {
				throw cause;
			})
		).rejects.toBeInstanceOf(UserLookupUnavailableError);

		expect((manager as any).refreshTokens.get(jti).isRevoked).toBe(false);
		// Once the lookup recovers, the same refresh token still works.
		expect(await manager.refreshAccessToken(refreshToken, CLIENT_ID, async () => ({ sub: USER_ID }))).not.toBeNull();
	});

	it('carries the cause and the user id on the lookup failure, and does not swallow it as a token error', async () => {
		const refreshToken = await issueRefreshToken();
		const cause = new Error('connection terminated');

		const error: unknown = await manager
			.refreshAccessToken(refreshToken, CLIENT_ID, async () => {
				throw cause;
			})
			.then(() => undefined, (caught) => caught);

		expect(error).toBeInstanceOf(UserLookupUnavailableError);
		// The guard the callers actually use, which also holds when `instanceof` is broken by a
		// downlevelled bundle.
		expect(UserLookupUnavailableError.is(error)).toBe(true);
		expect((error as UserLookupUnavailableError).userId).toBe(USER_ID);
		expect((error as UserLookupUnavailableError).cause).toBe(cause);
		expect(UserLookupUnavailableError.is(new Error('something else'))).toBe(false);
	});

	it('still answers null (not a lookup failure) when the token itself is bad', async () => {
		expect(await manager.refreshAccessToken('not-a-token', CLIENT_ID, async () => ({ sub: USER_ID }))).toBeNull();
	});

	it('does not consult the user for a token that fails the existing checks', async () => {
		const refreshToken = await issueRefreshToken();
		const resolveUser = jest.fn(async () => ({ sub: USER_ID }));

		expect(await manager.refreshAccessToken(refreshToken, 'other-client', resolveUser)).toBeNull();
		expect(resolveUser).not.toHaveBeenCalled();
	});
});
