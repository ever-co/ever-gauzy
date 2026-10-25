import { PermissionsEnum } from '@gauzy/contracts';

// The strategy only needs these for DI metadata; loading the real modules drags in the whole core
// entity graph, which cannot be required in isolation (pre-existing circular import).
jest.mock('../auth.service', () => ({ AuthService: class AuthService {} }));
jest.mock('../../employee/employee.service', () => ({ EmployeeService: class EmployeeService {} }));
jest.mock('../../user-organization/user-organization.services', () => ({
	UserOrganizationService: class UserOrganizationService {}
}));
jest.mock('../../role/role-authorization.service', () => ({
	RoleAuthorizationService: class RoleAuthorizationService {}
}));

import { AuthenticatedUserCache } from './authenticated-user-cache';
import { JwtStrategy } from './jwt.strategy';

/**
 * Owner decision Q12 (2026-10-24): an access token minted by the OAuth-app code exchange carries the scopes the user
 * approved (`oauthApp: { clientId, scopes }`), and `JwtStrategy` holds the request to them: the permissions it pins on
 * `request.user` are the role's INTERSECTED with what the scopes allow, and the grant is recorded so role checks
 * refuse. A token without the claim — a first-party session, or an OAuth-app token issued before the claim existed —
 * is judged exactly as before, and so is every token while `OAUTH_APP_TOKEN_SCOPE_ENFORCEMENT=false`.
 */
describe('JwtStrategy — OAuth-app tokens are held to their approved scopes', () => {
	/** What the user's role holds in the database: reads, writes and a reserved administrative permission. */
	const ROLE_PERMISSIONS = [
		PermissionsEnum.ORG_TASK_VIEW,
		PermissionsEnum.ORG_TASK_EDIT,
		PermissionsEnum.TIME_TRACKER,
		PermissionsEnum.CHANGE_ROLES_PERMISSIONS
	];

	const firstPartyPayload = { id: 'user-1', tenantId: 'tenant' };
	const oauthAppPayload = (scopes: unknown) => ({
		...firstPartyPayload,
		oauthApp: { clientId: 'zapier-app', scopes }
	});

	function build(authenticatedUsers?: AuthenticatedUserCache) {
		// A fresh user per lookup, as the database returns one.
		const authService = {
			getAuthenticatedUser: jest.fn(async () => ({
				id: 'user-1',
				tenantId: 'tenant',
				roleId: 'role-1',
				isActive: true,
				isArchived: false
			}))
		};
		const roleAuthorizationService = {
			attachAuthorizationState: jest.fn(async (user: any) => {
				user.role = { id: 'role-1', name: 'SUPER_ADMIN', tenantId: 'tenant' };
				user.permissions = ROLE_PERMISSIONS;
				return user;
			})
		};
		const strategy = new JwtStrategy(
			authService as any,
			{ findOneByIdString: jest.fn() } as any,
			{ findOneByOptions: jest.fn() } as any,
			roleAuthorizationService as any,
			authenticatedUsers ?? new AuthenticatedUserCache({ ttlMs: 0, ormType: 'typeorm' })
		);
		return { strategy, authService };
	}

	afterEach(() => {
		delete process.env.OAUTH_APP_TOKEN_SCOPE_ENFORCEMENT;
	});

	it('narrows a read-only token to the role’s read permissions', async () => {
		const { strategy } = build();

		const user = await strategy.validate(oauthAppPayload(['zap']));

		expect(user.permissions).toEqual([PermissionsEnum.ORG_TASK_VIEW]);
		expect(user.oauthApp).toEqual({ clientId: 'zapier-app', scopes: ['zap'] });
	});

	it('grants a read and write token everything of the role but the reserved permissions', async () => {
		const { strategy } = build();

		const user = await strategy.validate(oauthAppPayload(['zap', 'zap:write', 'authentication']));

		expect(user.permissions).toEqual([
			PermissionsEnum.ORG_TASK_VIEW,
			PermissionsEnum.ORG_TASK_EDIT,
			PermissionsEnum.TIME_TRACKER
		]);
	});

	it('never adds a permission the role does not hold', async () => {
		const { strategy } = build();

		const user = await strategy.validate(oauthAppPayload(['zap', 'zap:write']));

		expect(user.permissions).not.toContain(PermissionsEnum.ALL_ORG_EDIT);
		expect(user.permissions).not.toContain(PermissionsEnum.ORG_TEAM_VIEW);
	});

	it('grants an identity-only or unknown scope no permission at all', async () => {
		const { strategy } = build();

		expect((await strategy.validate(oauthAppPayload(['profile', 'email']))).permissions).toEqual([]);
		expect((await strategy.validate(oauthAppPayload(['admin']))).permissions).toEqual([]);
		expect((await strategy.validate(oauthAppPayload([]))).permissions).toEqual([]);
	});

	it('fails closed on a malformed claim', async () => {
		const { strategy } = build();

		const user = await strategy.validate({ ...firstPartyPayload, oauthApp: 'zap zap:write' });

		expect(user.permissions).toEqual([]);
		expect(user.oauthApp).toEqual({ clientId: '', scopes: [] });
	});

	it('leaves a first-party token, or a legacy OAuth-app token without the claim, exactly as before', async () => {
		const { strategy } = build();

		const user = await strategy.validate(firstPartyPayload);

		expect(user.permissions).toEqual(ROLE_PERMISSIONS);
		expect(user.oauthApp).toBeUndefined();
	});

	it('restores the previous behaviour when OAUTH_APP_TOKEN_SCOPE_ENFORCEMENT=false', async () => {
		process.env.OAUTH_APP_TOKEN_SCOPE_ENFORCEMENT = 'false';
		const { strategy } = build();

		const user = await strategy.validate(oauthAppPayload(['zap']));

		expect(user.permissions).toEqual(ROLE_PERMISSIONS);
		expect(user.oauthApp).toBeUndefined();
	});

	it('never lets the narrowed context reach a first-party request through the validated-context cache', async () => {
		// Both tokens name the same user, employee, organization and tenant: they share one cache key.
		const { strategy, authService } = build(new AuthenticatedUserCache({ ttlMs: 10_000, ormType: 'typeorm' }));

		const appUser = await strategy.validate(oauthAppPayload(['zap']));
		const sessionUser = await strategy.validate(firstPartyPayload);
		const appUserAgain = await strategy.validate(oauthAppPayload(['zap']));

		expect(authService.getAuthenticatedUser).toHaveBeenCalledTimes(1);
		expect(appUser.permissions).toEqual([PermissionsEnum.ORG_TASK_VIEW]);
		expect(sessionUser.permissions).toEqual(ROLE_PERMISSIONS);
		expect(sessionUser.oauthApp).toBeUndefined();
		expect(appUserAgain.permissions).toEqual([PermissionsEnum.ORG_TASK_VIEW]);
	});
});
