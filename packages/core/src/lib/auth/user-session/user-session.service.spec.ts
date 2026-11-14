// The service only needs these for DI metadata and types; loading the real modules drags in the whole core entity
// graph, which cannot be required in isolation (pre-existing circular import).
jest.mock('../../access-token/access-token.service', () => ({ AccessTokenService: class AccessTokenService {} }));
jest.mock('../../refresh-token/refresh-token.service', () => ({ RefreshTokenService: class RefreshTokenService {} }));
jest.mock('../../user/user.service', () => ({ UserService: class UserService {} }));
jest.mock('../../password-hash/password-hash.service', () => ({ PasswordHashService: class PasswordHashService {} }));
jest.mock('../login-attempt.service', () => ({
	LoginAttemptService: class LoginAttemptService {},
	LoginAttemptScope: { PASSWORD: 'password', MAGIC_CODE: 'magic-code' }
}));

import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import { environment } from '@gauzy/config';
import { RequestContext } from '../../core/context/request-context';
import { TokenStatus } from '../../token/interfaces/token.interface';
import { USER_SESSION_SIGNED_OUT_REASON } from './user-session-revocation';
import { SIGN_OUT_PASSES, UserSessionRefusal, UserSessionService } from './user-session.service';

const MARIE = 'marie';
const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000);

/** A stored, active token of Marie's in a session. */
function token(id: string, tokenType: string, metadata: Record<string, unknown> | null) {
	return {
		id,
		userId: MARIE,
		tokenType,
		status: TokenStatus.ACTIVE,
		expiresAt: FUTURE,
		lastUsedAt: null,
		createdAt: new Date('2026-11-14T08:00:00.000Z'),
		metadata
	};
}

const inSession = (sessionId: string, extra: Record<string, unknown> = {}) => ({
	sessionId,
	sessionStartedAt: '2026-11-14T08:00:00.000Z',
	...extra
});

/**
 * Marie, signed in on the web (the request's session) and on her laptop, with a personal API token's session too.
 */
function build({
	hash = 'hashed-password',
	passwordOk = true,
	codeOk = true,
	revokedAccess = [] as any[],
	signedOutSessions = [] as string[]
} = {}) {
	const refreshTokens = [
		token('r-web', 'REFRESH_TOKEN_TYPE', inSession('web')),
		token('r-laptop', 'REFRESH_TOKEN_TYPE', inSession('laptop'))
	];
	const accessTokens = [
		token('a-web', 'ACCESS_TOKEN_TYPE', inSession('web')),
		token('a-laptop', 'ACCESS_TOKEN_TYPE', inSession('laptop')),
		token('a-api', 'ACCESS_TOKEN_TYPE', { apiTokenId: 'api-token-1' })
	];
	const revoked: string[] = [];
	/** The sign-out markers written and the tokens revoked, in order. */
	const events: string[] = [];
	const revokeById = jest.fn(async ({ tokenId, reason }: { tokenId: string; reason: string }) => {
		expect(reason).toBe(USER_SESSION_SIGNED_OUT_REASON);
		// The store revokes no token past its expiry (`canRevoke`): it stays active until the expiry cleanup
		const stored = [...refreshTokens, ...accessTokens].find((candidate) => candidate.id === tokenId);
		if (stored && stored.expiresAt.getTime() < Date.now()) {
			return false;
		}
		revoked.push(tokenId);
		events.push(`revoke ${tokenId}`);
		// A revoked token is no longer active, as the store answers it.
		for (const list of [refreshTokens, accessTokens]) {
			const index = list.findIndex((candidate) => candidate.id === tokenId);
			if (index >= 0) {
				list.splice(index, 1);
			}
		}
		return true;
	});

	const attempt = { fail: jest.fn(async () => undefined), succeed: jest.fn(async () => undefined) };
	const services = {
		accessTokenService: {
			findActive: jest.fn(async () => accessTokens),
			findRevokedSince: jest.fn(async () => revokedAccess),
			revokeById,
			markSessionSignedOut: jest.fn(
				async (_userId: string, sessionId: string, _expiresAt: Date, _reason: string) => {
					events.push(`mark ${sessionId}`);
				}
			),
			isSessionSignedOut: jest.fn(async (_userId: string, sessionId: string) =>
				signedOutSessions.includes(sessionId)
			)
		},
		refreshTokenService: { findActive: jest.fn(async () => refreshTokens), revokeById },
		userService: {
			findOneByIdString: jest.fn(async () => ({ id: MARIE, email: 'marie@ever.co', hash })),
			claimSignInCode: jest.fn(async () => codeOk)
		},
		passwordHashService: { verify: jest.fn(async () => passwordOk) },
		loginAttemptService: { begin: jest.fn(async () => attempt) }
	};
	const service = new UserSessionService(
		services.accessTokenService as any,
		services.refreshTokenService as any,
		services.userService as any,
		services.passwordHashService as any,
		services.loginAttemptService as any
	);
	return { service, services, revoked, attempt, events };
}

/** A request made by Marie from the session `sessionId` (none: a token minted before sessions were named). */
function requestFrom(sessionId: string | null, extra: Record<string, unknown> = {}) {
	jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(MARIE);
	jest.spyOn(RequestContext, 'currentOAuthAppScopes').mockReturnValue(null);
	const claims = sessionId ? inSession(sessionId) : {};
	jest.spyOn(RequestContext, 'currentToken').mockReturnValue(sign({ id: MARIE, ...claims, ...extra }, 'k'));
}

afterEach(() => jest.restoreAllMocks());

describe('UserSessionService.listOwn', () => {
	it('lists the sessions of the user, the current one marked and first, without the API token session', async () => {
		const { service } = build();
		requestFrom('laptop');

		const sessions = await service.listOwn();

		expect(sessions.map(({ id, current }) => ({ id, current }))).toEqual([
			{ id: 'laptop', current: true },
			{ id: 'web', current: false }
		]);
	});

	it('leaves out a signed-out session, while a token minted in it during the sign-out is active', async () => {
		const { service, services } = build({ signedOutSessions: ['web'] });
		requestFrom('laptop');

		const sessions = await service.listOwn();

		expect(sessions.map(({ id }) => id)).toEqual(['laptop']);
		expect(services.accessTokenService.isSessionSignedOut).toHaveBeenCalledWith(MARIE, 'web');
	});

	it('is refused to a session that came from an API token', async () => {
		const { service } = build();
		requestFrom(null, { apiTokenId: 'api-token-1' });

		await expect(service.listOwn()).rejects.toThrow(ForbiddenException);
	});
});

describe('UserSessionService.signOutOthers', () => {
	it('signs out every other session with the password, and keeps the current one and the API token', async () => {
		const { service, revoked, attempt, events } = build();
		requestFrom('web');

		await expect(service.signOutOthers({ password: 'right' })).resolves.toEqual({ signedOut: 1 });

		expect(revoked.sort()).toEqual(['a-laptop', 'r-laptop']);
		expect(attempt.succeed).toHaveBeenCalled();
		expect(events.filter((event) => event.startsWith('mark'))).toEqual(['mark laptop']);
		expect(events.indexOf('mark laptop')).toBeLessThan(events.indexOf('revoke r-laptop'));
	});

	it('signs out nobody with a wrong password, and counts the try', async () => {
		const { service, revoked, attempt } = build({ passwordOk: false });
		requestFrom('web');

		await expect(service.signOutOthers({ password: 'wrong' })).rejects.toMatchObject({
			response: { code: UserSessionRefusal.CONFIRMATION_INVALID }
		});

		expect(revoked).toEqual([]);
		expect(attempt.fail).toHaveBeenCalled();
	});

	it('asks an account with a password for it', async () => {
		const { service, revoked } = build();
		requestFrom('web');

		await expect(service.signOutOthers({ code: 'ABC123' })).rejects.toMatchObject({
			response: { code: UserSessionRefusal.CONFIRMATION_REQUIRED }
		});
		expect(revoked).toEqual([]);
	});

	it('takes the sign-in code from an account without a password', async () => {
		const { service, services, revoked } = build({ hash: null });
		requestFrom('web');

		await expect(service.signOutOthers({ code: 'ABC123' })).resolves.toEqual({ signedOut: 1 });

		expect(services.userService.claimSignInCode).toHaveBeenCalledWith(MARIE, 'marie@ever.co', 'ABC123');
		expect(revoked.sort()).toEqual(['a-laptop', 'r-laptop']);
	});

	it('signs out nobody with a wrong or spent code', async () => {
		const { service, revoked } = build({ hash: null, codeOk: false });
		requestFrom('web');

		await expect(service.signOutOthers({ code: 'WRONG1' })).rejects.toThrow(BadRequestException);
		expect(revoked).toEqual([]);
	});

	it('answers a conflict when the request names no session yet', async () => {
		const { service, revoked } = build();
		requestFrom(null);

		await expect(service.signOutOthers({ password: 'right' })).rejects.toThrow(ConflictException);
		expect(revoked).toEqual([]);
	});
});

/**
 * A token store where a refresh of the laptop lands while a sign-out runs: the laptop's refresh token is rotated (so
 * revoking it fails), and its successor and a new access token appear, in the same session as the refresh token they
 * replace (or, for a refresh token minted before sessions were named, in a new one).
 */
function storeWithRefreshDuringSignOut({ legacy = false } = {}) {
	const laptopSession = legacy ? null : inSession('laptop');
	const successorSession = inSession(legacy ? 'laptop-after-refresh' : 'laptop');
	let refreshTokens: any[] = [
		token('r-web', 'REFRESH_TOKEN_TYPE', inSession('web')),
		token('r-laptop', 'REFRESH_TOKEN_TYPE', laptopSession)
	];
	let accessTokens: any[] = [token('a-web', 'ACCESS_TOKEN_TYPE', inSession('web'))];
	const revoked: string[] = [];
	const revokeById = jest.fn(async ({ tokenId }: { tokenId: string }) => {
		if (tokenId === 'r-laptop') {
			// The refresh got there first: the old token is rotated, its successor and a new access token are active.
			refreshTokens = refreshTokens.filter((candidate) => candidate.id !== 'r-laptop');
			refreshTokens.push({
				...token('r-laptop-2', 'REFRESH_TOKEN_TYPE', successorSession),
				rotatedFromTokenId: 'r-laptop'
			});
			accessTokens.push(token('a-laptop-2', 'ACCESS_TOKEN_TYPE', successorSession));
			return false;
		}
		revoked.push(tokenId);
		refreshTokens = refreshTokens.filter((candidate) => candidate.id !== tokenId);
		accessTokens = accessTokens.filter((candidate) => candidate.id !== tokenId);
		return true;
	});
	const attempt = { fail: jest.fn(async () => undefined), succeed: jest.fn(async () => undefined) };
	const marked: string[] = [];
	const markSessionSignedOut = jest.fn(async (_userId: string, sessionId: string) => {
		marked.push(sessionId);
	});
	const service = new UserSessionService(
		{
			findActive: jest.fn(async () => accessTokens),
			findRevokedSince: jest.fn(async () => []),
			revokeById,
			markSessionSignedOut
		} as any,
		{ findActive: jest.fn(async () => refreshTokens), revokeById } as any,
		{ findOneByIdString: jest.fn(async () => ({ id: MARIE, email: 'marie@ever.co', hash: 'h' })) } as any,
		{ verify: jest.fn(async () => true) } as any,
		{ begin: jest.fn(async () => attempt) } as any
	);
	return { service, revoked, marked };
}

/**
 * A token store where a refresh of the laptop lands on each of the first `landings` passes of a sign-out: each time the
 * laptop's refresh token is rotated before it can be revoked, and its successor is active.
 */
function storeWhereRefreshesKeepLanding(landings: number) {
	let generation = 1;
	let refreshTokens: any[] = [
		token('r-web', 'REFRESH_TOKEN_TYPE', inSession('web')),
		token('r-laptop-1', 'REFRESH_TOKEN_TYPE', inSession('laptop'))
	];
	const accessTokens: any[] = [token('a-web', 'ACCESS_TOKEN_TYPE', inSession('web'))];
	const revokeById = jest.fn(async ({ tokenId }: { tokenId: string }) => {
		refreshTokens = refreshTokens.filter((candidate) => candidate.id !== tokenId);
		const isLanding = tokenId === `r-laptop-${generation}` && generation <= landings;
		if (isLanding) {
			generation++;
			refreshTokens.push(token(`r-laptop-${generation}`, 'REFRESH_TOKEN_TYPE', inSession('laptop')));
			return false;
		}
		return true;
	});
	const service = new UserSessionService(
		{
			findActive: jest.fn(async () => accessTokens),
			findRevokedSince: jest.fn(async () => []),
			revokeById,
			markSessionSignedOut: jest.fn(async () => undefined)
		} as any,
		{ findActive: jest.fn(async () => refreshTokens), revokeById } as any,
		{} as any,
		{} as any,
		{} as any
	);
	return { service, refreshTokens: () => refreshTokens };
}

describe('UserSessionService, a refresh landing while a sign-out runs', () => {
	it('signs out the tokens the refresh minted for the session too', async () => {
		const { service, revoked } = storeWithRefreshDuringSignOut();
		requestFrom('web');

		await service.signOutOthers({ password: 'right' });

		expect(revoked.sort()).toEqual(['a-laptop-2', 'r-laptop-2']);
	});

	it('reports a sign-out its last pass finished as done', async () => {
		const { service, refreshTokens } = storeWhereRefreshesKeepLanding(SIGN_OUT_PASSES - 1);
		requestFrom('web');

		await expect(service.signOut('laptop')).resolves.toBeUndefined();

		expect(refreshTokens().map((candidate) => candidate.id)).toEqual(['r-web']);
	});

	it('answers a conflict when refreshes keep landing after the last pass', async () => {
		const { service } = storeWhereRefreshesKeepLanding(SIGN_OUT_PASSES);
		requestFrom('web');

		await expect(service.signOut('laptop')).rejects.toMatchObject({
			response: { code: UserSessionRefusal.SIGN_OUT_INCOMPLETE }
		});
	});

	it('marks the session a refresh started during the sign-out of an old token too', async () => {
		const { service, marked } = storeWithRefreshDuringSignOut({ legacy: true });
		requestFrom('web');

		await service.signOutOthers({ password: 'right' });

		expect(marked).toEqual(['laptop-after-refresh']);
	});

	it('never reports a sign-out that left a token active', async () => {
		const { service, services } = build();
		// A token that stays active whatever the revocation answers.
		services.refreshTokenService.revokeById.mockImplementation(async () => false);
		services.accessTokenService.revokeById.mockImplementation(async () => false);
		requestFrom('web');

		await expect(service.signOutOthers({ password: 'right' })).rejects.toMatchObject({
			response: { code: UserSessionRefusal.SIGN_OUT_INCOMPLETE }
		});
	});

	it('refuses to sign out alone a session minted before sessions were named, whose access token names none', async () => {
		const { service, revoked } = storeWithRefreshDuringSignOut({ legacy: true });
		requestFrom('web');

		await expect(service.signOut('r-laptop')).rejects.toMatchObject({
			response: { code: UserSessionRefusal.UNNAMED_SESSION }
		});
		expect(revoked).toEqual([]);
	});
});

describe('UserSessionService, an access token logged out before its session is signed out', () => {
	it('gives it the sign-out reason, so it is refused too, and leaves the current session and API tokens alone', async () => {
		const loggedOut = (id: string, metadata: Record<string, unknown>) => ({
			...token(id, 'ACCESS_TOKEN_TYPE', metadata),
			status: TokenStatus.REVOKED,
			revokedReason: 'User initiated logout'
		});
		const { service, services } = build({
			revokedAccess: [
				loggedOut('a-laptop-old', inSession('laptop')),
				loggedOut('a-web-old', inSession('web')),
				loggedOut('a-api-old', { apiTokenId: 'api-token-1' })
			]
		});
		requestFrom('web');

		await service.signOutOthers({ password: 'right' });

		const revised = services.accessTokenService.revokeById.mock.calls
			.map(([revocation]: any[]) => revocation)
			.filter((revocation: any) => revocation.reviseRevoked);
		expect(revised.map((revocation: any) => revocation.tokenId)).toEqual(['a-laptop-old']);
	});

	const loggedOutLaptopToken = () => ({
		...token('a-laptop-old', 'ACCESS_TOKEN_TYPE', inSession('laptop')),
		status: TokenStatus.REVOKED,
		revokedReason: 'User initiated logout'
	});
	const revisionsOf = (revokeById: jest.Mock) =>
		revokeById.mock.calls.filter(([revocation]: any[]) => revocation.reviseRevoked).length;

	it('reads again and retries a revision that did not apply', async () => {
		const { service, services } = build({ revokedAccess: [loggedOutLaptopToken()] });
		const revoke = services.accessTokenService.revokeById.getMockImplementation();
		let revisions = 0;
		services.accessTokenService.revokeById.mockImplementation(async (revocation: any) => {
			if (!revocation.reviseRevoked) {
				return revoke(revocation);
			}
			revisions++;
			return revisions > 1;
		});
		requestFrom('web');

		await expect(service.signOutOthers({ password: 'right' })).resolves.toEqual({ signedOut: 1 });

		expect(revisionsOf(services.accessTokenService.revokeById)).toBe(2);
	});

	it('answers a conflict when a revision never applies', async () => {
		const { service, services } = build({ revokedAccess: [loggedOutLaptopToken()] });
		const revoke = services.accessTokenService.revokeById.getMockImplementation();
		services.accessTokenService.revokeById.mockImplementation(async (revocation: any) => {
			if (!revocation.reviseRevoked) {
				return revoke(revocation);
			}
			return false;
		});
		requestFrom('web');

		await expect(service.signOutOthers({ password: 'right' })).rejects.toMatchObject({
			response: { code: UserSessionRefusal.SIGN_OUT_INCOMPLETE }
		});
	});
});

describe('UserSessionService.signOut', () => {
	it('signs out one other session, its access and refresh tokens', async () => {
		const { service, revoked } = build();
		requestFrom('web');

		await service.signOut('laptop');

		expect(revoked.sort()).toEqual(['a-laptop', 'r-laptop']);
	});

	it('finishes with an expired access token of the session still active, which nothing can use or revoke', async () => {
		const { service, services, revoked } = build();
		const accessTokens = await services.accessTokenService.findActive();
		accessTokens.push({
			...token('a-laptop-old', 'ACCESS_TOKEN_TYPE', inSession('laptop')),
			expiresAt: new Date(Date.now() - 60 * 60 * 1000)
		});
		requestFrom('web');

		await expect(service.signOut('laptop')).resolves.toBeUndefined();

		expect(revoked.sort()).toEqual(['a-laptop', 'r-laptop']);
	});

	it('writes the marker of the session before it revokes a token, kept as long as a token can live', async () => {
		const { service, services, events } = build();
		requestFrom('web');
		const before = Date.now();

		await service.signOut('laptop');

		expect(events[0]).toBe('mark laptop');
		expect(events.filter((event) => event.startsWith('mark'))).toEqual(['mark laptop']);
		const [userId, sessionId, expiresAt, reason] = services.accessTokenService.markSessionSignedOut.mock.calls[0];
		expect([userId, sessionId, reason]).toEqual([MARIE, 'laptop', USER_SESSION_SIGNED_OUT_REASON]);
		const refreshLifetimeMs = (Number(environment.JWT_REFRESH_TOKEN_EXPIRATION_TIME) || 30 * 24 * 60 * 60) * 1000;
		expect((expiresAt as Date).getTime()).toBeGreaterThanOrEqual(before + refreshLifetimeMs);
	});

	it('refuses the session of the request', async () => {
		const { service, revoked } = build();
		requestFrom('web');

		await expect(service.signOut('web')).rejects.toMatchObject({
			response: { code: UserSessionRefusal.CURRENT_SESSION }
		});
		expect(revoked).toEqual([]);
	});

	it('answers not found for an id that names no session of the user', async () => {
		const { service } = build();
		requestFrom('web');

		await expect(service.signOut('somebody-else')).rejects.toThrow(NotFoundException);
	});
});
