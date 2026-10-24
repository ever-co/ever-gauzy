import '../core/entities/internal';

import { RequestContext } from '../core/context';
import { AuthService } from './auth.service';

/**
 * A stored organization (`user.lastOrganizationId`) scopes a new token only while the user is still a member of it
 * (follow-up of ever-co/ever-gauzy#11357).
 *
 * Sign-in, workspace sign-in (password, social and magic-code sign-ins all end there), workspace switch and token
 * refresh used the stored organization as the token's organization without checking it. Once the user's membership
 * of it was removed, deactivated or archived, every token they got named an organization `JwtStrategy` refuses, so
 * they could not get back in. A stale stored organization is now replaced by the user's first active membership of
 * the tenant (or cleared when there is none), on the user and in the database. A valid one is used exactly as before.
 */

const TENANT = '7a000000-0000-4000-8000-00000000000a';
const TARGET_TENANT = '7a000000-0000-4000-8000-00000000000b';
const ORG_STALE = '7a000000-0000-4000-8000-0000000000a0';
const ORG_FIRST = '7a000000-0000-4000-8000-0000000000a1';
const ORG_MEMBER = '7a000000-0000-4000-8000-0000000000a2';
const ORG_EMPLOYEE = '7a000000-0000-4000-8000-0000000000a3';
const ORG_TARGET = '7a000000-0000-4000-8000-0000000000b1';
/** The organization another request switches the user to while a sign-in replaces their stale one. */
const ORG_SWITCHED = '7a000000-0000-4000-8000-0000000000c1';
const TEAM = '7a000000-0000-4000-8000-0000000000d1';

interface Membership {
	organizationId: string;
	tenantId: string;
}

/** A fresh user per test: the service writes the replacement onto the object it is given. */
const userWith = (lastOrganizationId: string | null, tenantId = TENANT) => ({
	id: 'u-1',
	email: 'pat@ever.co',
	tenantId,
	tenant: { id: tenantId },
	lastOrganizationId,
	hash: 'stored-hash',
	isActive: true,
	isArchived: false
});

/**
 * An AuthService whose collaborators are in memory. `memberships` are the user's ACTIVE, non-archived memberships,
 * oldest first. The minted tokens name the organization they were scoped to.
 */
function buildAuthService({
	user,
	memberships,
	employee = null
}: {
	user: ReturnType<typeof userWith>;
	memberships: Membership[];
	employee?: { id: string; organizationId: string; isActive: boolean; isArchived: boolean } | null;
}) {
	const service: AuthService = Object.create(AuthService.prototype);

	/** The user's row as the database holds it: the writes below apply to it as the real ones would. */
	const stored: { lastOrganizationId: string | null; lastTeamId: string | null } = {
		lastOrganizationId: user.lastOrganizationId,
		lastTeamId: null
	};

	const isMember = (userId: string, organizationId: string, tenantId: string) =>
		userId === user.id && memberships.some((m) => m.organizationId === organizationId && m.tenantId === tenantId);
	const firstMembership = (userId: string, tenantId: string) =>
		(userId === user.id && memberships.find((m) => m.tenantId === tenantId)?.organizationId) || null;

	const getJwtAccessToken = jest.fn(
		async (_user: unknown, organizationId?: string) => `access:${organizationId ?? 'none'}`
	);
	const getJwtRefreshToken = jest.fn(
		async (_user: unknown, organizationId?: string) => `refresh:${organizationId ?? 'none'}`
	);
	const rotateRefreshToken = jest.fn(
		async (_token: string, _user: unknown, organizationId?: string) => `rotated:${organizationId ?? 'none'}`
	);
	const attempt = {
		fail: jest.fn(async () => undefined),
		succeed: jest.fn(async () => undefined),
		release: jest.fn(async () => undefined)
	};
	const userService = {
		find: jest.fn(async () => [user]),
		hasActiveOrganizationMembership: jest.fn(async (userId: string, organizationId: string, tenantId: string) =>
			isMember(userId, organizationId, tenantId)
		),
		findFirstActiveOrganizationId: jest.fn(async (userId: string, tenantId: string) =>
			firstMembership(userId, tenantId)
		),
		// Conditional, as the real write: only while the row still holds the stale organization.
		replaceStaleLastOrganization: jest.fn(
			async (_userId: string, staleOrganizationId: string, organizationId: string | null) => {
				if (stored.lastOrganizationId === staleOrganizationId) {
					stored.lastOrganizationId = organizationId;
				}
			}
		),
		// Unconditional, as the real write: each value it is given that is set.
		setLastOrganizationAndTeam: jest.fn(async (_userId: string, organizationId?: string, teamId?: string) => {
			if (organizationId) {
				stored.lastOrganizationId = organizationId;
			}
			if (teamId) {
				stored.lastTeamId = teamId;
			}
		}),
		setCurrentRefreshToken: jest.fn(async () => undefined),
		setUserLastLoginTimestamp: jest.fn(async () => undefined)
	};

	Object.assign(service, {
		ormType: 'typeorm',
		logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn() },
		loginAttemptService: { begin: jest.fn(async () => attempt) },
		passwordHashService: {
			verify: jest.fn(async () => true),
			needsRehash: jest.fn(() => false),
			hash: jest.fn(async (value: string) => `hashed:${value}`)
		},
		employeeService: { findOneByUserId: jest.fn(async () => employee) },
		typeOrmUserRepository: {
			findOne: jest.fn(async () => user),
			findOneOrFail: jest.fn(async () => user),
			update: jest.fn(async () => undefined)
		},
		typeOrmEmployeeRepository: { findOne: jest.fn(async () => employee) },
		userService,
		isDeactivatedEmployeeUser: jest.fn(async () => false),
		// The defaults the sign-ins already had, over the same memberships.
		resolveDefaultOrganizationId: jest.fn(async (userId: string, tenantId: string) =>
			firstMembership(userId, tenantId)
		),
		hasActiveOrganizationMembership: jest.fn(async (userId: string, organizationId: string, tenantId: string) =>
			isMember(userId, organizationId, tenantId)
		),
		getJwtAccessToken,
		getJwtRefreshToken,
		rotateRefreshToken
	});

	return { service, userService, stored, getJwtAccessToken, getJwtRefreshToken };
}

/** The workspace token the sign-in flows hand out for a user. */
const workspaceTokenFor = (service: AuthService, user: ReturnType<typeof userWith>) =>
	(service as any).generateToken(user, 'ABC123');

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentIp').mockReturnValue('203.0.113.7');
	jest.spyOn(RequestContext, 'currentUserAgent').mockReturnValue('jest');
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('AuthService.login (POST /auth/login) — stored organization', () => {
	it('scopes the token to the stored organization while the user is still a member of it', async () => {
		const user = userWith(ORG_MEMBER);
		const { service, userService, getJwtAccessToken } = buildAuthService({
			user,
			memberships: [
				{ organizationId: ORG_FIRST, tenantId: TENANT },
				{ organizationId: ORG_MEMBER, tenantId: TENANT }
			]
		});

		const result = await service.login({ email: user.email, password: 'right' });

		expect(result.token).toBe(`access:${ORG_MEMBER}`);
		expect(getJwtAccessToken).toHaveBeenCalledWith(user, ORG_MEMBER);
		expect(userService.hasActiveOrganizationMembership).toHaveBeenCalledWith(user.id, ORG_MEMBER, TENANT);
		expect(userService.replaceStaleLastOrganization).not.toHaveBeenCalled();
		expect(result.user.lastOrganizationId).toBe(ORG_MEMBER);
	});

	it('replaces a stored organization the user is no longer a member of by their first membership', async () => {
		// Before the fix the token named ORG_STALE, which JwtStrategy refuses on every request.
		const user = userWith(ORG_STALE);
		const { service, userService, getJwtAccessToken, getJwtRefreshToken } = buildAuthService({
			user,
			memberships: [
				{ organizationId: ORG_FIRST, tenantId: TENANT },
				{ organizationId: ORG_MEMBER, tenantId: TENANT }
			]
		});

		const result = await service.login({ email: user.email, password: 'right' });

		expect(result.token).toBe(`access:${ORG_FIRST}`);
		expect(result.refresh_token).toBe(`refresh:${ORG_FIRST}`);
		expect(getJwtAccessToken).toHaveBeenCalledWith(expect.anything(), ORG_FIRST);
		expect(getJwtRefreshToken).toHaveBeenCalledWith(expect.anything(), ORG_FIRST);
		expect(userService.replaceStaleLastOrganization).toHaveBeenCalledWith(user.id, ORG_STALE, ORG_FIRST);
		expect(result.user.lastOrganizationId).toBe(ORG_FIRST);
	});

	it('clears a stale stored organization when the user has no active membership left', async () => {
		const user = userWith(ORG_STALE);
		const { service, userService, getJwtAccessToken, getJwtRefreshToken } = buildAuthService({
			user,
			memberships: []
		});

		const result = await service.login({ email: user.email, password: 'right' });

		expect(result.token).toBe('access:none');
		expect(getJwtAccessToken).toHaveBeenCalledWith(expect.anything(), null);
		// The refresh token falls back to the user's stored organization: it must not find the stale one there.
		expect(getJwtRefreshToken).toHaveBeenCalledWith(expect.objectContaining({ lastOrganizationId: null }), null);
		expect(userService.replaceStaleLastOrganization).toHaveBeenCalledWith(user.id, ORG_STALE, null);
		expect(userService.setLastOrganizationAndTeam).not.toHaveBeenCalled();
		expect(result.user.lastOrganizationId).toBeNull();
	});

	it('does not read the stored organization of an employee: the employee organization wins', async () => {
		const user = userWith(ORG_STALE);
		const { service, userService } = buildAuthService({
			user,
			memberships: [{ organizationId: ORG_EMPLOYEE, tenantId: TENANT }],
			employee: { id: 'e-1', organizationId: ORG_EMPLOYEE, isActive: true, isArchived: false }
		});

		const result = await service.login({ email: user.email, password: 'right' });

		expect(result.token).toBe(`access:${ORG_EMPLOYEE}`);
		expect(userService.hasActiveOrganizationMembership).not.toHaveBeenCalled();
		expect(userService.replaceStaleLastOrganization).not.toHaveBeenCalled();
	});

	it('keeps the stored organization when the membership lookup fails: an outage never clears it', async () => {
		const user = userWith(ORG_MEMBER);
		const { service, userService } = buildAuthService({
			user,
			memberships: [{ organizationId: ORG_MEMBER, tenantId: TENANT }]
		});
		userService.hasActiveOrganizationMembership.mockRejectedValueOnce(new Error('connection terminated'));

		const result = await service.login({ email: user.email, password: 'right' });

		expect(result.token).toBe(`access:${ORG_MEMBER}`);
		expect(userService.replaceStaleLastOrganization).not.toHaveBeenCalled();
		expect(result.user.lastOrganizationId).toBe(ORG_MEMBER);
	});

	it('still scopes the token to the replacement when the stale value cannot be written', async () => {
		const user = userWith(ORG_STALE);
		const { service, userService } = buildAuthService({
			user,
			memberships: [{ organizationId: ORG_FIRST, tenantId: TENANT }]
		});
		userService.replaceStaleLastOrganization.mockRejectedValueOnce(new Error('connection terminated'));

		const result = await service.login({ email: user.email, password: 'right' });

		expect(result.token).toBe(`access:${ORG_FIRST}`);
	});

	it('keeps an organization another request switched to while the stale one was being replaced', async () => {
		const user = userWith(ORG_STALE);
		const { service, userService, stored } = buildAuthService({
			user,
			memberships: [
				{ organizationId: ORG_FIRST, tenantId: TENANT },
				{ organizationId: ORG_SWITCHED, tenantId: TENANT }
			]
		});
		userService.findFirstActiveOrganizationId.mockImplementationOnce(async () => {
			stored.lastOrganizationId = ORG_SWITCHED;
			return ORG_FIRST;
		});

		const result = await service.login({ email: user.email, password: 'right' });

		expect(result.token).toBe(`access:${ORG_FIRST}`);
		expect(userService.setLastOrganizationAndTeam).not.toHaveBeenCalled();
		expect(stored.lastOrganizationId).toBe(ORG_SWITCHED);
	});
});

describe('AuthService.workspaceSigninVerifyToken (POST /auth/signin.workspace) — stored organization', () => {
	it('replaces a stale stored organization with the first active membership, written once', async () => {
		const user = userWith(ORG_STALE);
		const { service, userService, stored } = buildAuthService({
			user,
			memberships: [{ organizationId: ORG_FIRST, tenantId: TENANT }]
		});
		const token = workspaceTokenFor(service, user);

		const result = await service.workspaceSigninVerifyToken({ email: user.email, token } as any);

		expect(result.token).toBe(`access:${ORG_FIRST}`);
		expect(userService.replaceStaleLastOrganization).toHaveBeenCalledWith(user.id, ORG_STALE, ORG_FIRST);
		// The replacement is the conditional write above; it is not written a second time.
		expect(userService.setLastOrganizationAndTeam).toHaveBeenCalledWith(user.id, undefined, undefined);
		expect(stored.lastOrganizationId).toBe(ORG_FIRST);
	});

	it('keeps an organization another request switched to while the stale one was being replaced', async () => {
		const user = userWith(ORG_STALE);
		const { service, userService, stored } = buildAuthService({
			user,
			memberships: [
				{ organizationId: ORG_FIRST, tenantId: TENANT },
				{ organizationId: ORG_SWITCHED, tenantId: TENANT }
			]
		});
		// `POST /auth/switch-organization` stores ORG_SWITCHED between the stale check and the replacement.
		userService.findFirstActiveOrganizationId.mockImplementationOnce(async () => {
			stored.lastOrganizationId = ORG_SWITCHED;
			return ORG_FIRST;
		});
		const token = workspaceTokenFor(service, user);

		const result = await service.workspaceSigninVerifyToken({ email: user.email, token, lastTeamId: TEAM } as any);

		// This sign-in's token is scoped to the replacement it resolved; the switch survives in the database.
		expect(result.token).toBe(`access:${ORG_FIRST}`);
		expect(stored.lastOrganizationId).toBe(ORG_SWITCHED);
		// The team preference is still written.
		expect(userService.setLastOrganizationAndTeam).toHaveBeenCalledWith(user.id, undefined, TEAM);
		expect(stored.lastTeamId).toBe(TEAM);
	});

	it('keeps a stored organization the user is still a member of, without writing it again', async () => {
		const user = userWith(ORG_MEMBER);
		const { service, userService, stored } = buildAuthService({
			user,
			memberships: [
				{ organizationId: ORG_FIRST, tenantId: TENANT },
				{ organizationId: ORG_MEMBER, tenantId: TENANT }
			]
		});
		const token = workspaceTokenFor(service, user);

		const result = await service.workspaceSigninVerifyToken({ email: user.email, token } as any);

		expect(result.token).toBe(`access:${ORG_MEMBER}`);
		expect(userService.replaceStaleLastOrganization).not.toHaveBeenCalled();
		expect(userService.setLastOrganizationAndTeam).toHaveBeenCalledWith(user.id, undefined, undefined);
		expect(stored.lastOrganizationId).toBe(ORG_MEMBER);
	});

	it('persists the first membership of a user with nothing stored, as before', async () => {
		const user = userWith(null);
		const { service, userService, stored } = buildAuthService({
			user,
			memberships: [{ organizationId: ORG_FIRST, tenantId: TENANT }]
		});
		const token = workspaceTokenFor(service, user);

		const result = await service.workspaceSigninVerifyToken({ email: user.email, token } as any);

		expect(result.token).toBe(`access:${ORG_FIRST}`);
		expect(userService.replaceStaleLastOrganization).not.toHaveBeenCalled();
		expect(userService.setLastOrganizationAndTeam).toHaveBeenCalledWith(user.id, ORG_FIRST, undefined);
		expect(stored.lastOrganizationId).toBe(ORG_FIRST);
	});

	it('scopes the token to a requested membership without reading the stored organization', async () => {
		const user = userWith(ORG_STALE);
		const { service, userService, stored } = buildAuthService({
			user,
			memberships: [
				{ organizationId: ORG_FIRST, tenantId: TENANT },
				{ organizationId: ORG_MEMBER, tenantId: TENANT }
			]
		});
		const token = workspaceTokenFor(service, user);

		const result = await service.workspaceSigninVerifyToken({
			email: user.email,
			token,
			lastOrganizationId: ORG_MEMBER,
			lastTeamId: TEAM
		} as any);

		expect(result.token).toBe(`access:${ORG_MEMBER}`);
		expect(userService.hasActiveOrganizationMembership).not.toHaveBeenCalled();
		// An explicit selection is persisted with the team, as before.
		expect(userService.setLastOrganizationAndTeam).toHaveBeenCalledWith(user.id, ORG_MEMBER, TEAM);
		expect(stored.lastOrganizationId).toBe(ORG_MEMBER);
		expect(stored.lastTeamId).toBe(TEAM);
	});
});

describe('AuthService.switchWorkspace (POST /auth/switch-workspace) — stored organization', () => {
	it('checks the stored organization against the target workspace and replaces a stale one', async () => {
		const user = userWith(ORG_STALE, TARGET_TENANT);
		const { service, userService } = buildAuthService({
			user,
			memberships: [
				// A membership of the same organization id in the tenant being left does not count.
				{ organizationId: ORG_STALE, tenantId: TENANT },
				{ organizationId: ORG_TARGET, tenantId: TARGET_TENANT }
			]
		});
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: user.id,
			email: user.email,
			tenantId: TENANT
		} as any);

		const result = await service.switchWorkspace(TARGET_TENANT);

		expect(result.token).toBe(`access:${ORG_TARGET}`);
		expect(userService.hasActiveOrganizationMembership).toHaveBeenCalledWith(user.id, ORG_STALE, TARGET_TENANT);
		expect(userService.findFirstActiveOrganizationId).toHaveBeenCalledWith(user.id, TARGET_TENANT);
		expect(userService.replaceStaleLastOrganization).toHaveBeenCalledWith(user.id, ORG_STALE, ORG_TARGET);
	});
});

describe('AuthService.rotateTokens (POST /auth/refresh-token) — stored organization', () => {
	it('keeps the organization of a member', async () => {
		const user = userWith(ORG_MEMBER);
		const { service, userService } = buildAuthService({
			user,
			memberships: [{ organizationId: ORG_MEMBER, tenantId: TENANT }]
		});
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(user as any);

		await expect(service.rotateTokens('presented-refresh-token')).resolves.toEqual({
			token: `access:${ORG_MEMBER}`,
			refresh_token: `rotated:${ORG_MEMBER}`
		});
		expect(userService.replaceStaleLastOrganization).not.toHaveBeenCalled();
	});

	it('scopes the refreshed tokens to the first active membership when the stored organization is stale', async () => {
		const user = userWith(ORG_STALE);
		const { service, userService } = buildAuthService({
			user,
			memberships: [{ organizationId: ORG_FIRST, tenantId: TENANT }]
		});
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(user as any);

		await expect(service.rotateTokens('presented-refresh-token')).resolves.toEqual({
			token: `access:${ORG_FIRST}`,
			refresh_token: `rotated:${ORG_FIRST}`
		});
		expect(userService.replaceStaleLastOrganization).toHaveBeenCalledWith(user.id, ORG_STALE, ORG_FIRST);
	});
});
