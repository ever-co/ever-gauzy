// cspell:ignore KHTML
import { UserSessionAppEnum } from '@gauzy/contracts';
import { IToken, TokenStatus } from '../../token/interfaces';
import { groupUserSessions, isFirstPartyAccessToken, listUserSessions } from './user-session-list';

const NOW = new Date('2026-11-14T12:00:00.000Z');
const LATER = new Date('2026-11-15T12:00:00.000Z');
const LAPTOP_UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const PHONE_UA =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

/** A stored, active token. */
function token(overrides: Partial<IToken> & { metadata?: Record<string, unknown> | null }): IToken {
	return {
		id: 'token',
		userId: 'marie',
		tokenType: 'REFRESH_TOKEN_TYPE',
		status: TokenStatus.ACTIVE,
		expiresAt: LATER,
		lastUsedAt: null,
		createdAt: new Date('2026-11-14T08:00:00.000Z'),
		metadata: null,
		...overrides
	} as IToken;
}

const session = (sessionId: string, sessionStartedAt: string, extra: Record<string, unknown> = {}) => ({
	sessionId,
	sessionStartedAt,
	...extra
});

describe('listUserSessions', () => {
	it('lists the refresh and access tokens of one sign-in as one session, with its device', () => {
		const tokens = {
			refreshTokens: [
				token({
					id: 'r-laptop',
					metadata: session('laptop', '2026-11-14T08:00:00.000Z', {
						userAgent: LAPTOP_UA,
						ipAddress: '10.0.0.1'
					})
				})
			],
			accessTokens: [
				token({
					id: 'a-laptop',
					tokenType: 'ACCESS_TOKEN_TYPE',
					lastUsedAt: new Date('2026-11-14T11:30:00.000Z'),
					createdAt: new Date('2026-11-14T09:00:00.000Z'),
					metadata: session('laptop', '2026-11-14T08:00:00.000Z', {
						userAgent: LAPTOP_UA,
						ipAddress: '10.0.0.2'
					})
				})
			]
		};

		expect(listUserSessions(tokens, null, NOW)).toEqual([
			{
				id: 'laptop',
				current: false,
				app: UserSessionAppEnum.WEB,
				browser: 'Chrome 131',
				os: 'Windows',
				userAgent: LAPTOP_UA,
				ipAddress: '10.0.0.2',
				signedInAt: new Date('2026-11-14T08:00:00.000Z'),
				lastActiveAt: new Date('2026-11-14T11:30:00.000Z')
			}
		]);
	});

	it('marks the session of the request and lists it first, then the most recently used', () => {
		const tokens = {
			refreshTokens: [
				token({ id: 'r-old', metadata: session('old', '2026-11-01T00:00:00.000Z', { userAgent: PHONE_UA }) }),
				token({
					id: 'r-web',
					lastUsedAt: new Date('2026-11-14T10:00:00.000Z'),
					metadata: session('web', '2026-11-14T08:00:00.000Z', { userAgent: LAPTOP_UA })
				}),
				token({
					id: 'r-phone',
					lastUsedAt: new Date('2026-11-14T11:00:00.000Z'),
					metadata: session('phone', '2026-11-13T08:00:00.000Z', { userAgent: PHONE_UA })
				})
			],
			accessTokens: []
		};

		const sessions = listUserSessions(tokens, 'web', NOW);

		expect(sessions.map(({ id, current }) => ({ id, current }))).toEqual([
			{ id: 'web', current: true },
			{ id: 'phone', current: false },
			{ id: 'old', current: false }
		]);
	});

	it('lists a refresh token minted before sessions were named as a session of its own', () => {
		const tokens = {
			refreshTokens: [token({ id: 'r-legacy', metadata: { userAgent: LAPTOP_UA } })],
			accessTokens: []
		};

		const [legacy] = listUserSessions(tokens, null, NOW);

		expect(legacy.id).toBe('r-legacy');
		expect(legacy.signedInAt).toEqual(new Date('2026-11-14T08:00:00.000Z'));
	});

	it('leaves out what is no session of the user: expired tokens, API-token and application tokens, old access tokens', () => {
		const tokens = {
			refreshTokens: [token({ id: 'r-expired', expiresAt: new Date('2026-11-14T11:00:00.000Z') })],
			accessTokens: [
				token({
					id: 'a-api',
					tokenType: 'ACCESS_TOKEN_TYPE',
					metadata: session('s-api', '2026-11-14T08:00:00.000Z', { apiTokenId: 'k' })
				}),
				token({
					id: 'a-app',
					tokenType: 'ACCESS_TOKEN_TYPE',
					metadata: session('s-app', '2026-11-14T08:00:00.000Z', { oauthApp: { clientId: 'c' } })
				}),
				token({ id: 'a-legacy', tokenType: 'ACCESS_TOKEN_TYPE', metadata: { userAgent: LAPTOP_UA } })
			]
		};

		expect(listUserSessions(tokens, null, NOW)).toEqual([]);
	});
});

describe('groupUserSessions', () => {
	it('keeps an access-only session that names its session', () => {
		const groups = groupUserSessions(
			{
				refreshTokens: [],
				accessTokens: [
					token({
						id: 'a1',
						tokenType: 'ACCESS_TOKEN_TYPE',
						metadata: session('s1', '2026-11-14T08:00:00.000Z')
					})
				]
			},
			NOW
		);

		expect(groups.map((group) => ({ id: group.id, tokens: group.tokens.map((t) => t.id) }))).toEqual([
			{ id: 's1', tokens: ['a1'] }
		]);
	});
});

describe('isFirstPartyAccessToken', () => {
	it('tells a sign-in token from an API token exchange and an application grant', () => {
		expect(isFirstPartyAccessToken(token({ metadata: { id: 'marie' } }))).toBe(true);
		expect(isFirstPartyAccessToken(token({ metadata: null }))).toBe(true);
		expect(isFirstPartyAccessToken(token({ metadata: { apiTokenId: 'k' } }))).toBe(false);
		expect(isFirstPartyAccessToken(token({ metadata: { oauthApp: { clientId: 'c' } } }))).toBe(false);
	});
});
