import '../core/entities/internal';

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

	Object.assign(service, {
		ormType: 'typeorm',
		logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn() },
		typeOrmUserRepository: { findOne: jest.fn(async () => ({ ...user, isActive: true, isArchived: false })) },
		typeOrmEmployeeRepository: { findOne: jest.fn(async () => ({ id: 'employee-1', organizationId: ORG })) },
		accessTokenService: {
			generate: jest.fn(async (_userId: string, payload: Record<string, unknown>) => {
				accessPayloads.push(payload);
				return `access-${accessPayloads.length}`;
			})
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

	return { service, accessPayloads, refreshPayloads };
}

/** A request, public (a sign-in) or made by `userId` with a bearer token carrying `claims`. */
function inRequest({ userId, claims }: { userId: string | null; claims?: Record<string, unknown> }) {
	jest.spyOn(RequestContext, 'currentRequest').mockReturnValue({});
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
