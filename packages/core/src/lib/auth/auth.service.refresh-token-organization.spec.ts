import '../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { RequestContext } from '../core/context';
import { AuthService } from './auth.service';

/**
 * A token refresh keeps the organization of the refresh token it comes from (ever-co/ever-gauzy#11827).
 *
 * `POST /auth/switch-organization` stores the organization switched to on the user (`lastOrganizationId`), for the
 * whole account, and a refresh scoped its new tokens to that stored organization. A switch made in one client therefore
 * moved every other client of the account at its next refresh: the desktop app working in A got a token for B, and its
 * timer stopped B's run and filed its time in B. A refresh now keeps the organization its refresh token was minted for
 * while the user is still an active member of it, and falls back to the stored organization as before otherwise. The
 * switch still stores the organization: it is where the next sign-in starts.
 */

const TENANT = '7c000000-0000-4000-8000-00000000000a';
const USER = '7c000000-0000-4000-8000-0000000000e1';
const ORG_A = '7c000000-0000-4000-8000-0000000000a1';
const ORG_B = '7c000000-0000-4000-8000-0000000000b1';
/** An organization the user belonged to when the refresh token was minted, and has left since. */
const ORG_LEFT = '7c000000-0000-4000-8000-0000000000c1';
/** A stored organization the user has left too. */
const ORG_STALE = '7c000000-0000-4000-8000-0000000000d1';

/** The user's row as the database holds it. */
interface StoredUser {
	lastOrganizationId: string | null;
}

/**
 * An AuthService whose collaborators are in memory. `memberships` are the user's ACTIVE, non-archived memberships of
 * the tenant, oldest first; the writes apply to `stored` as the real ones would. The minted tokens name their
 * organization.
 */
function buildAuthService({ memberships, stored }: { memberships: string[]; stored: StoredUser }) {
	const service: AuthService = Object.create(AuthService.prototype);

	const isMember = (userId: string, organizationId: string, tenantId: string) =>
		userId === USER && tenantId === TENANT && memberships.includes(organizationId);

	const userService = {
		hasActiveOrganizationMembership: jest.fn(async (userId: string, organizationId: string, tenantId: string) =>
			isMember(userId, organizationId, tenantId)
		),
		findFirstActiveOrganizationId: jest.fn(
			async (userId: string, tenantId: string) =>
				(userId === USER && tenantId === TENANT && memberships[0]) || null
		),
		// Conditional, as the real write: only while the row still holds the stale organization.
		replaceStaleLastOrganization: jest.fn(
			async (_userId: string, staleOrganizationId: string, organizationId: string | null) => {
				if (stored.lastOrganizationId === staleOrganizationId) {
					stored.lastOrganizationId = organizationId;
				}
			}
		),
		// The write `switchOrganization` makes.
		update: jest.fn(async (_userId: string, { lastOrganizationId }: { lastOrganizationId: string }) => {
			stored.lastOrganizationId = lastOrganizationId;
		}),
		setCurrentRefreshToken: jest.fn(async () => undefined)
	};

	Object.assign(service, {
		ormType: 'typeorm',
		logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn() },
		userService,
		// `switchOrganization`: the membership it requires, the user it reads, the employee of the organization.
		userOrganizationService: {
			findOneByOptions: jest.fn(async ({ where }) => {
				if (isMember(where.userId, where.organizationId, where.tenantId)) {
					return { ...where };
				}
				throw new NotFoundException();
			})
		},
		typeOrmUserRepository: {
			findOne: jest.fn(async () => ({ id: USER, email: 'pat@ever.co', tenantId: TENANT, ...stored }))
		},
		employeeService: { findOneByUserId: jest.fn(async () => null) },
		getJwtAccessToken: jest.fn(
			async (_user: unknown, organizationId?: string) => `access:${organizationId ?? 'none'}`
		),
		getJwtRefreshToken: jest.fn(
			async (_user: unknown, organizationId?: string) => `refresh:${organizationId ?? 'none'}`
		),
		rotateRefreshToken: jest.fn(
			async (_token: string, _user: unknown, organizationId?: string) => `rotated:${organizationId ?? 'none'}`
		)
	});

	return { service, userService };
}

/**
 * The user `JwtRefreshTokenStrategy` attaches to a refresh request: the row as stored, with the organization of the
 * refresh token it verified.
 */
function refreshWith(stored: StoredUser, refreshTokenOrganizationId: string | null | undefined) {
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
		id: USER,
		email: 'pat@ever.co',
		tenantId: TENANT,
		lastOrganizationId: stored.lastOrganizationId,
		isActive: true,
		isArchived: false,
		refreshTokenOrganizationId
	} as any);
}

/** The user `JwtStrategy` attaches to a request made with an access token for `organizationId`. */
function signedInTo(organizationId: string) {
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
		id: USER,
		email: 'pat@ever.co',
		tenantId: TENANT,
		lastOrganizationId: organizationId
	} as any);
}

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	jest.spyOn(RequestContext, 'currentIp').mockReturnValue('203.0.113.7');
	jest.spyOn(RequestContext, 'currentUserAgent').mockReturnValue('jest');
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('AuthService.rotateTokens (POST /auth/refresh-token) — the refresh token organization', () => {
	it('keeps the organization of the refresh token when another client switched the account to another one', async () => {
		// Before the fix both tokens named ORG_B, the organization the other client switched to.
		const stored = { lastOrganizationId: ORG_B };
		const { service, userService } = buildAuthService({ memberships: [ORG_A, ORG_B], stored });
		refreshWith(stored, ORG_A);

		await expect(service.rotateTokens('refresh-token-for-a')).resolves.toEqual({
			token: `access:${ORG_A}`,
			refresh_token: `rotated:${ORG_A}`
		});
		expect(userService.hasActiveOrganizationMembership).toHaveBeenCalledWith(USER, ORG_A, TENANT);
		// The stored organization is left as it is: it is where the next sign-in starts.
		expect(userService.replaceStaleLastOrganization).not.toHaveBeenCalled();
		expect(stored.lastOrganizationId).toBe(ORG_B);
	});

	it('keeps the organization of the refresh token when its membership cannot be checked', async () => {
		// As a stored organization is kept on a failed lookup: JwtStrategy still judges the token on every request.
		const stored = { lastOrganizationId: ORG_B };
		const { service, userService } = buildAuthService({ memberships: [ORG_A, ORG_B], stored });
		userService.hasActiveOrganizationMembership.mockRejectedValueOnce(new Error('connection terminated'));
		refreshWith(stored, ORG_A);

		await expect(service.rotateTokens('refresh-token-for-a')).resolves.toEqual({
			token: `access:${ORG_A}`,
			refresh_token: `rotated:${ORG_A}`
		});
		expect(userService.replaceStaleLastOrganization).not.toHaveBeenCalled();
	});

	it('replaces a stale stored organization that the refresh token names too, checking it once as before', async () => {
		const stored = { lastOrganizationId: ORG_STALE };
		const { service, userService } = buildAuthService({ memberships: [ORG_A, ORG_B], stored });
		refreshWith(stored, ORG_STALE);

		await expect(service.rotateTokens('refresh-token-for-stale')).resolves.toEqual({
			token: `access:${ORG_A}`,
			refresh_token: `rotated:${ORG_A}`
		});
		expect(userService.hasActiveOrganizationMembership).toHaveBeenCalledTimes(1);
		expect(userService.replaceStaleLastOrganization).toHaveBeenCalledWith(USER, ORG_STALE, ORG_A);
		expect(stored.lastOrganizationId).toBe(ORG_A);
	});

	it('falls back to the stored organization when the user left the organization of the refresh token', async () => {
		const stored = { lastOrganizationId: ORG_B };
		const { service, userService } = buildAuthService({ memberships: [ORG_A, ORG_B], stored });
		refreshWith(stored, ORG_LEFT);

		await expect(service.rotateTokens('refresh-token-for-left')).resolves.toEqual({
			token: `access:${ORG_B}`,
			refresh_token: `rotated:${ORG_B}`
		});
		expect(userService.replaceStaleLastOrganization).not.toHaveBeenCalled();
	});

	it('replaces a stale stored organization as before when the user left both', async () => {
		const stored = { lastOrganizationId: ORG_STALE };
		const { service, userService } = buildAuthService({ memberships: [ORG_A, ORG_B], stored });
		refreshWith(stored, ORG_LEFT);

		await expect(service.rotateTokens('refresh-token-for-left')).resolves.toEqual({
			token: `access:${ORG_A}`,
			refresh_token: `rotated:${ORG_A}`
		});
		expect(userService.replaceStaleLastOrganization).toHaveBeenCalledWith(USER, ORG_STALE, ORG_A);
		expect(stored.lastOrganizationId).toBe(ORG_A);
	});

	it.each([
		['names no organization', null],
		['reaches the service without one', undefined]
	])('falls back to the stored organization when the refresh token %s', async (_label, organizationId) => {
		const stored = { lastOrganizationId: ORG_B };
		const { service } = buildAuthService({ memberships: [ORG_A, ORG_B], stored });
		refreshWith(stored, organizationId);

		await expect(service.rotateTokens('refresh-token-without-organization')).resolves.toEqual({
			token: `access:${ORG_B}`,
			refresh_token: `rotated:${ORG_B}`
		});
	});
});

describe('AuthService.getAccessTokenFromRefreshToken — the refresh token organization', () => {
	it('mints for the organization of the refresh token, not the one another client switched to', async () => {
		const stored = { lastOrganizationId: ORG_B };
		const { service } = buildAuthService({ memberships: [ORG_A, ORG_B], stored });
		refreshWith(stored, ORG_A);

		await expect(service.getAccessTokenFromRefreshToken()).resolves.toEqual({
			token: `access:${ORG_A}`,
			refresh_token: `refresh:${ORG_A}`
		});
	});
});

describe('AuthService.switchOrganization (POST /auth/switch-organization)', () => {
	it('still stores the organization switched to, where the next sign-in starts', async () => {
		const stored = { lastOrganizationId: ORG_A };
		const { service, userService } = buildAuthService({ memberships: [ORG_A, ORG_B], stored });
		signedInTo(ORG_A);

		const result = await service.switchOrganization(ORG_B);

		expect(result.token).toBe(`access:${ORG_B}`);
		expect(result.refresh_token).toBe(`refresh:${ORG_B}`);
		expect(userService.update).toHaveBeenCalledWith(USER, { lastOrganizationId: ORG_B });
		expect(stored.lastOrganizationId).toBe(ORG_B);
	});
});

describe('two clients of one account', () => {
	it('a switch in one client no longer moves the other at its next refresh', async () => {
		const stored = { lastOrganizationId: ORG_A };
		const { service } = buildAuthService({ memberships: [ORG_A, ORG_B], stored });

		// Client 2 switches the account to B.
		signedInTo(ORG_A);
		await service.switchOrganization(ORG_B);

		// Client 1 refreshes with its refresh token, minted for A: it stays in A (before the fix it moved to B).
		refreshWith(stored, ORG_A);
		await expect(service.rotateTokens('client-1-refresh-token')).resolves.toEqual({
			token: `access:${ORG_A}`,
			refresh_token: `rotated:${ORG_A}`
		});

		// Client 2 refreshes with its refresh token, minted for B by the switch: it stays in B.
		refreshWith(stored, ORG_B);
		await expect(service.rotateTokens('client-2-refresh-token')).resolves.toEqual({
			token: `access:${ORG_B}`,
			refresh_token: `rotated:${ORG_B}`
		});
		expect(stored.lastOrganizationId).toBe(ORG_B);
	});
});
