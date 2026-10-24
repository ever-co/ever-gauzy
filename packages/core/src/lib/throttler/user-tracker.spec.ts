import { sign, SignOptions } from 'jsonwebtoken';
import { ACCESS_TOKEN_TYPE } from '../access-token/type.token';
import { TOKEN_PURPOSE_CLAIM, TokenPurposeEnum } from '../auth/purpose-token';
import { resolveUserThrottlerTracker, USER_THROTTLER_TRACKER_PREFIX } from './user-tracker';

/**
 * Owner decision 16: signed-in requests are rate-limited per user (the access token's subject), not per
 * address. The throttler runs before authentication, so it verifies the token itself; the property under
 * test is that only a token `JwtStrategy` would also accept up to its database checks can name a user
 * bucket. Anything else (forged, expired, another algorithm, a purpose token, no subject) yields `null`, and
 * the request is then counted by address.
 */
describe('resolveUserThrottlerTracker', () => {
	const SECRET = 'user-tracker-spec-secret-0123456789abcdef';

	/** An access token as `AccessTokenService` issues it, signed with `secret`. */
	const accessToken = (claims: Record<string, unknown>, options: SignOptions = {}, secret = SECRET) =>
		sign({ tokenType: ACCESS_TOKEN_TYPE, ...claims }, secret, { algorithm: 'HS256', expiresIn: 600, ...options });

	const bearer = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });

	it('buckets a verified access token by the user it names', () => {
		expect(resolveUserThrottlerTracker(bearer(accessToken({ id: 'user-a', tenantId: 't1' })), SECRET)).toBe(
			`${USER_THROTTLER_TRACKER_PREFIX}user-a`
		);
	});

	it('keeps two users apart, and one user in one bucket across tokens', () => {
		const a1 = resolveUserThrottlerTracker(bearer(accessToken({ id: 'user-a' })), SECRET);
		const a2 = resolveUserThrottlerTracker(bearer(accessToken({ id: 'user-a', organizationId: 'o2' })), SECRET);
		const b = resolveUserThrottlerTracker(bearer(accessToken({ id: 'user-b' })), SECRET);

		expect(a1).toBe(a2);
		expect(b).not.toBe(a1);
	});

	it('accepts a legacy token with neither tokenType nor purpose, as JwtStrategy does', () => {
		const legacy = sign({ id: 'user-legacy' }, SECRET, { algorithm: 'HS256', expiresIn: 600 });

		expect(resolveUserThrottlerTracker(bearer(legacy), SECRET)).toBe('user:user-legacy');
	});

	it('buckets a token that names only a third-party id in its own namespace', () => {
		expect(resolveUserThrottlerTracker(bearer(accessToken({ thirdPartyId: 'gh-42' })), SECRET)).toBe(
			'user:third-party:gh-42'
		);
	});

	it('reads the scheme case-insensitively, like passport-jwt', () => {
		const token = accessToken({ id: 'user-a' });

		expect(resolveUserThrottlerTracker({ headers: { authorization: `bearer ${token}` } }, SECRET)).toBe(
			'user:user-a'
		);
	});

	it('never believes a token signed with another secret', () => {
		const forged = accessToken({ id: 'user-a' }, {}, 'attacker-secret-0123456789abcdef');

		expect(resolveUserThrottlerTracker(bearer(forged), SECRET)).toBeNull();
	});

	it('refuses an expired or not-yet-valid token', () => {
		const expired = sign(
			{ id: 'user-a', tokenType: ACCESS_TOKEN_TYPE, exp: Math.floor(Date.now() / 1000) - 60 },
			SECRET,
			{ algorithm: 'HS256' }
		);
		const notYet = accessToken({ id: 'user-a' }, { notBefore: 3600 });

		expect(resolveUserThrottlerTracker(bearer(expired), SECRET)).toBeNull();
		expect(resolveUserThrottlerTracker(bearer(notYet), SECRET)).toBeNull();
	});

	it('refuses any algorithm but HS256, including an unsigned token', () => {
		const hs512 = accessToken({ id: 'user-a' }, { algorithm: 'HS512' });
		const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
		const header = part({ alg: 'none', typ: 'JWT' });
		const unsigned = `${header}.${part({ id: 'user-a', tokenType: ACCESS_TOKEN_TYPE })}.`;

		expect(resolveUserThrottlerTracker(bearer(hs512), SECRET)).toBeNull();
		expect(resolveUserThrottlerTracker(bearer(unsigned), SECRET)).toBeNull();
	});

	it('refuses a token minted for another purpose with the same secret', () => {
		const resetClaims = { id: 'user-a', [TOKEN_PURPOSE_CLAIM]: TokenPurposeEnum.PASSWORD_RESET };
		const passwordReset = sign(resetClaims, SECRET, { algorithm: 'HS256', expiresIn: 600 });
		const refresh = accessToken({ id: 'user-a', tokenType: 'REFRESH_TOKEN_TYPE' });

		expect(resolveUserThrottlerTracker(bearer(passwordReset), SECRET)).toBeNull();
		expect(resolveUserThrottlerTracker(bearer(refresh), SECRET)).toBeNull();
	});

	it('refuses a verified token that names no user', () => {
		expect(resolveUserThrottlerTracker(bearer(accessToken({ tenantId: 't1' })), SECRET)).toBeNull();
		expect(resolveUserThrottlerTracker(bearer(accessToken({ id: '   ' })), SECRET)).toBeNull();
	});

	it('answers null, never throws, for a request without a usable bearer token', () => {
		const token = accessToken({ id: 'user-a' });

		expect(resolveUserThrottlerTracker({ headers: {} }, SECRET)).toBeNull();
		expect(resolveUserThrottlerTracker({ headers: { authorization: token } }, SECRET)).toBeNull();
		expect(resolveUserThrottlerTracker({ headers: { authorization: `Basic ${token}` } }, SECRET)).toBeNull();
		expect(resolveUserThrottlerTracker({ headers: { authorization: 'Bearer not-a-jwt' } }, SECRET)).toBeNull();
		expect(resolveUserThrottlerTracker({}, SECRET)).toBeNull();
		expect(resolveUserThrottlerTracker(undefined, SECRET)).toBeNull();
	});

	it('answers null when no secret is configured', () => {
		expect(resolveUserThrottlerTracker(bearer(accessToken({ id: 'user-a' })), '')).toBeNull();
	});
});
