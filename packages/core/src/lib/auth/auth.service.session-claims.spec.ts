import '../core/entities/internal';

import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import { RequestContext } from '../core/context';
import { AuthService } from './auth.service';

/**
 * Every token of one sign-in names the same session (ever-co/ever-gauzy#11921), so that a user can list where they are
 * signed in and sign a session out as a whole. The access and refresh tokens of a sign-in share a new session, a
 * refresh keeps the session of the refresh token it replaces, and a token an API token or a third-party application
 * exchanged for names none.
 */

const TENANT = '7c000000-0000-4000-8000-00000000000a';
const USER = '7c000000-0000-4000-8000-0000000000e1';
const ORG = '7c000000-0000-4000-8000-0000000000a1';

const user = {
	id: USER,
	email: 'marie@ever.co',
	tenantId: TENANT,
	lastOrganizationId: ORG,
	role: { name: 'EMPLOYEE' }
};

/** An AuthService whose collaborators are in memory; the minted tokens are their payloads. */
function buildAuthService() {
	const service: AuthService = Object.create(AuthService.prototype);
	const accessPayloads: Record<string, unknown>[] = [];
	const refreshPayloads: Record<string, unknown>[] = [];
	/** The sessions Marie signed out: their sign-out markers. */
	const signedOut = new Set<string>();

	Object.assign(service, {
		ormType: 'typeorm',
		logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn() },
		typeOrmUserRepository: { findOne: jest.fn(async () => ({ ...user, isActive: true, isArchived: false })) },
		typeOrmEmployeeRepository: { findOne: jest.fn(async () => ({ id: 'employee-1', organizationId: ORG })) },
		accessTokenService: {
			generate: jest.fn(async (_userId: string, payload: Record<string, unknown>) => {
				accessPayloads.push(payload);
				return `access-${accessPayloads.length}`;
			}),
			isSessionSignedOut: jest.fn(async (_userId: string, sessionId: string) => signedOut.has(sessionId))
		},
		refreshTokenService: {
			generate: jest.fn(async (_userId: string, payload: Record<string, unknown>) => {
				refreshPayloads.push(payload);
				return `refresh-${refreshPayloads.length}`;
			}),
			rotate: jest.fn(async (_token: string, payload: Record<string, unknown>) => {
				refreshPayloads.push(payload);
				return `rotated-${refreshPayloads.length}`;
			})
		},
		userService: { setCurrentRefreshToken: jest.fn(async () => undefined) },
		resolveRefreshOrganizationId: jest.fn(async () => ORG)
	});

	return { service, accessPayloads, refreshPayloads, signedOut };
}

/** A request, public (a sign-in) or made by `userId` with a bearer token carrying `claims`, and its `headers`. */
function inRequest({
	userId,
	claims,
	headers
}: {
	userId: string | null;
	claims?: Record<string, unknown>;
	headers?: Record<string, string>;
}) {
	jest.spyOn(RequestContext, 'currentRequest').mockReturnValue(headers ? { headers } : {});
	jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(userId);
	jest.spyOn(RequestContext, 'currentToken').mockReturnValue(claims ? sign({ id: userId, ...claims }, 'k') : null);
	if (userId) {
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			...user,
			isActive: true,
			isArchived: false
		} as any);
	}
}

afterEach(() => jest.restoreAllMocks());

describe('AuthService, the session a minted token names', () => {
	it('gives the access and the refresh token of a sign-in the same new session', async () => {
		const { service, accessPayloads, refreshPayloads } = buildAuthService();
		inRequest({ userId: null });

		await Promise.all([service.getJwtAccessToken(user, ORG), service.getJwtRefreshToken(user, ORG)]);

		expect(accessPayloads[0].sessionId).toEqual(expect.any(String));
		expect(refreshPayloads[0].sessionId).toBe(accessPayloads[0].sessionId);
		expect(refreshPayloads[0].sessionStartedAt).toBe(accessPayloads[0].sessionStartedAt);
	});

	it('gives two sign-ins two sessions', async () => {
		const { service, accessPayloads } = buildAuthService();
		inRequest({ userId: null });
		await service.getJwtAccessToken(user, ORG);
		inRequest({ userId: null });
		await service.getJwtAccessToken(user, ORG);

		expect(accessPayloads[1].sessionId).not.toBe(accessPayloads[0].sessionId);
	});

	it('keeps the session of the refresh token a refresh replaces', async () => {
		const { service, accessPayloads, refreshPayloads } = buildAuthService();
		inRequest({ userId: USER });
		const presented = sign({ id: USER, sessionId: 'laptop', sessionStartedAt: '2026-11-10T08:00:00.000Z' }, 'k');

		await service.rotateTokens(presented);

		expect(accessPayloads[0]).toMatchObject({ sessionId: 'laptop', sessionStartedAt: '2026-11-10T08:00:00.000Z' });
		expect(refreshPayloads[0]).toMatchObject({ sessionId: 'laptop', sessionStartedAt: '2026-11-10T08:00:00.000Z' });
	});

	it('starts a session, dated from its issue, for a refresh token minted before sessions were named', async () => {
		const { service, accessPayloads, refreshPayloads } = buildAuthService();
		inRequest({ userId: USER });
		const issuedAt = Math.floor(new Date('2026-11-09T07:00:00.000Z').getTime() / 1000);
		const presented = sign({ id: USER, iat: issuedAt }, 'k');

		await service.rotateTokens(presented);

		expect(accessPayloads[0].sessionId).toEqual(expect.any(String));
		expect(refreshPayloads[0].sessionId).toBe(accessPayloads[0].sessionId);
		expect(accessPayloads[0].sessionStartedAt).toBe('2026-11-09T07:00:00.000Z');
	});

	it('keeps the session of the request when the user switches organization', async () => {
		const { service, accessPayloads, refreshPayloads } = buildAuthService();
		inRequest({ userId: USER, claims: { sessionId: 'phone', sessionStartedAt: '2026-11-12T07:30:00.000Z' } });

		await Promise.all([service.getJwtAccessToken(user, ORG), service.getJwtRefreshToken(user, ORG)]);

		expect(accessPayloads[0].sessionId).toBe('phone');
		expect(refreshPayloads[0].sessionId).toBe('phone');
	});

	it('names no session in a token an API token was exchanged for', async () => {
		const { service, accessPayloads } = buildAuthService();
		inRequest({ userId: null });

		await service.getJwtAccessToken(user, ORG, { apiTokenId: 'api-token-1' });

		expect(accessPayloads[0].sessionId).toBeUndefined();
		expect(accessPayloads[0].sessionStartedAt).toBeUndefined();
	});

	it('names no session in a token a third-party application was given', async () => {
		const { service, accessPayloads } = buildAuthService();
		inRequest({ userId: null });

		await service.getJwtAccessToken(user, ORG, { oauthApp: { clientId: 'app', scopes: ['read'] } as any });

		expect(accessPayloads[0].sessionId).toBeUndefined();
	});
});

/**
 * Every token of a sign-in or a renewal records the app it came from (ever-co/ever-gauzy#11983): the name the app gives
 * itself in `X-Client-App`, and the web host of a browser's request. The sessions list names each session with them.
 */
describe('AuthService, the app a minted token records', () => {
	const fromEverTeams = { 'x-client-app': 'Ever Teams', origin: 'https://app.ever.team' };
	const everTeams = { appName: 'Ever Teams', appOrigin: 'app.ever.team' };

	it('records the app of a sign-in in its access and refresh tokens', async () => {
		const { service, accessPayloads, refreshPayloads } = buildAuthService();
		inRequest({ userId: null, headers: fromEverTeams });

		await Promise.all([service.getJwtAccessToken(user, ORG), service.getJwtRefreshToken(user, ORG)]);

		expect(accessPayloads[0]).toMatchObject(everTeams);
		expect(refreshPayloads[0]).toMatchObject(everTeams);
	});

	it('records the app of a renewal, whose tokens the sessions list reads', async () => {
		const { service, accessPayloads, refreshPayloads } = buildAuthService();
		inRequest({ userId: USER, headers: fromEverTeams });

		await service.rotateTokens(
			sign({ id: USER, sessionId: 'laptop', sessionStartedAt: '2026-11-10T08:00:00.000Z' }, 'k')
		);

		expect(accessPayloads[0]).toMatchObject(everTeams);
		expect(refreshPayloads[0]).toMatchObject(everTeams);
	});

	it('records nothing a request does not tell, and no name that is not a plain one', async () => {
		const { service, accessPayloads } = buildAuthService();
		inRequest({ userId: null, headers: { 'x-client-app': '<img src=x>', origin: 'null' } });

		await service.getJwtAccessToken(user, ORG);

		expect(accessPayloads[0]).not.toHaveProperty('appName');
		expect(accessPayloads[0]).not.toHaveProperty('appOrigin');
	});
});

/**
 * A session its user signed out gets no new token (ever-co/ever-gauzy#11921): a request authenticated just before the
 * sign-out still reaches its mint, so the mint reads the session's sign-out marker first.
 */
describe('AuthService, a mint in a signed-out session', () => {
	const phone = { sessionId: 'phone', sessionStartedAt: '2026-11-12T07:30:00.000Z' };

	it('is refused for an organization switch from that session', async () => {
		const { service, accessPayloads, refreshPayloads, signedOut } = buildAuthService();
		signedOut.add('phone');
		inRequest({ userId: USER, claims: phone });

		await expect(service.getJwtAccessToken(user, ORG)).rejects.toThrow(UnauthorizedException);
		await expect(service.getJwtRefreshToken(user, ORG)).rejects.toThrow(UnauthorizedException);

		expect(accessPayloads).toEqual([]);
		expect(refreshPayloads).toEqual([]);
	});

	it('is refused for a refresh of that session', async () => {
		const { service, accessPayloads, signedOut } = buildAuthService();
		signedOut.add('phone');
		inRequest({ userId: USER });

		await expect(service.rotateTokens(sign({ id: USER, ...phone }, 'k'))).rejects.toThrow(UnauthorizedException);

		expect(accessPayloads).toEqual([]);
		expect((service as any).refreshTokenService.rotate).not.toHaveBeenCalled();
	});

	it('is let through for a session still signed in', async () => {
		const { service, accessPayloads, signedOut } = buildAuthService();
		signedOut.add('laptop');
		inRequest({ userId: USER, claims: phone });

		await service.getJwtAccessToken(user, ORG);

		expect(accessPayloads[0].sessionId).toBe('phone');
	});

	it('answers 503, not 401, when the database cannot be reached for the marker, so the client keeps its token', async () => {
		const { service, accessPayloads } = buildAuthService();
		const unreachable = Object.assign(new Error('connect ECONNREFUSED 10.0.0.5:5432'), {
			code: 'ECONNREFUSED',
			syscall: 'connect'
		});
		(service as any).accessTokenService.isSessionSignedOut.mockRejectedValue(unreachable);
		inRequest({ userId: USER, claims: phone });

		await expect(service.getJwtAccessToken(user, ORG)).rejects.toThrow(ServiceUnavailableException);
		await expect(service.getJwtRefreshToken(user, ORG)).rejects.toThrow(ServiceUnavailableException);
		inRequest({ userId: USER });
		await expect(service.rotateTokens(sign({ id: USER, ...phone }, 'k'))).rejects.toThrow(
			ServiceUnavailableException
		);

		expect(accessPayloads).toEqual([]);
		expect((service as any).refreshTokenService.rotate).not.toHaveBeenCalled();
	});

	it('reads no marker for a session the request starts: a sign-in, or a refresh of an older token', async () => {
		const { service } = buildAuthService();
		inRequest({ userId: null });
		await Promise.all([service.getJwtAccessToken(user, ORG), service.getJwtRefreshToken(user, ORG)]);
		inRequest({ userId: USER });
		await service.rotateTokens(sign({ id: USER }, 'k'));

		expect((service as any).accessTokenService.isSessionSignedOut).not.toHaveBeenCalled();
	});
});
