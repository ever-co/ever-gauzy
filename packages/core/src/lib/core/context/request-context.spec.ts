import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { environment as env } from '@gauzy/config';
import { HttpException } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import { RequestContext } from './request-context';

/**
 * GHSA-m8xc-8pwr-89fj — role and permission decisions used to be taken by re-decoding the raw bearer
 * token and reading its `role` / `permissions` claims. Those claims are frozen when the token is
 * issued and nothing invalidates an outstanding token, so a demoted user kept their former privileges
 * (RoleGuard, the SUPER_ADMIN short-circuit in TenantPermissionGuard / OrganizationPermissionGuard, and
 * every in-service RequestContext.hasPermission check) for up to JWT_TOKEN_EXPIRATION_TIME — 24 hours
 * by default.
 *
 * The verdict now comes from the user object JwtStrategy attaches to the request, which is re-read from
 * the database on every single request. Each test below therefore pairs a PRIVILEGED token with an
 * UNPRIVILEGED request user: the claims say super admin, the database says employee.
 */
describe('RequestContext role and permission checks', () => {
	/**
	 * A token minted while the user still held the privileged role. Signed with the real secret, so a
	 * verify()-based implementation accepts it happily.
	 */
	const staleSuperAdminToken = sign(
		{
			id: 'user-1',
			role: RolesEnum.SUPER_ADMIN,
			permissions: [PermissionsEnum.SUPER_ADMIN_EDIT, PermissionsEnum.ORG_USERS_EDIT]
		},
		env.JWT_SECRET
	);

	/**
	 * Installs a request context holding `user`, with the stale token on the Authorization header.
	 */
	function setContext(user: unknown, token: string | null = staleSuperAdminToken): void {
		const store = new Map<string, unknown>();

		RequestContext.setClsService({
			get: (key: string) => store.get(key),
			set: (key: string, value: unknown) => store.set(key, value)
		} as any);

		const req = {
			headers: token ? { authorization: `Bearer ${token}` } : {},
			user
		};

		store.set(RequestContext.name, new RequestContext({ req: req as any }));
	}

	afterEach(() => {
		RequestContext.setClsService(undefined as any);
	});

	/** The user as the database has them today: demoted to EMPLOYEE with only a viewing permission. */
	const demotedUser = {
		id: 'user-1',
		tenantId: 'tenant-1',
		roleId: 'role-employee',
		role: { id: 'role-employee', name: RolesEnum.EMPLOYEE },
		permissions: [PermissionsEnum.ORG_TEAM_VIEW]
	};

	describe('hasRoles', () => {
		it('does not authorize a demoted user whose token still claims SUPER_ADMIN', () => {
			setContext(demotedUser);
			expect(RequestContext.hasRoles([RolesEnum.SUPER_ADMIN])).toBe(false);
		});

		it('authorizes the role the user actually holds', () => {
			setContext(demotedUser);
			expect(RequestContext.hasRole(RolesEnum.EMPLOYEE)).toBe(true);
			expect(RequestContext.hasRoles([RolesEnum.ADMIN, RolesEnum.EMPLOYEE])).toBe(true);
		});

		it('authorizes a user who really is a super admin', () => {
			setContext({ ...demotedUser, role: { id: 'role-sa', name: RolesEnum.SUPER_ADMIN } });
			expect(RequestContext.hasRoles([RolesEnum.SUPER_ADMIN])).toBe(true);
		});

		it('accepts the bare role name RegisterAuthorizationGuard used to attach', () => {
			setContext({ id: 'user-1', tenantId: 'tenant-1', role: RolesEnum.ADMIN });
			expect(RequestContext.hasRoles([RolesEnum.ADMIN])).toBe(true);
			expect(RequestContext.hasRoles([RolesEnum.SUPER_ADMIN])).toBe(false);
		});

		it('denies when there is no authenticated user, even with a valid token on the header', () => {
			setContext(undefined);
			expect(RequestContext.hasRoles([RolesEnum.SUPER_ADMIN])).toBe(false);
		});

		it('denies when the user has no resolvable role', () => {
			setContext({ id: 'user-1', tenantId: 'tenant-1' });
			expect(RequestContext.hasRoles([RolesEnum.SUPER_ADMIN, RolesEnum.EMPLOYEE])).toBe(false);
		});

		it('throws when asked to and the role does not match', () => {
			setContext(demotedUser);
			expect(() => RequestContext.hasRoles([RolesEnum.SUPER_ADMIN], true)).toThrow(HttpException);
		});
	});

	describe('hasPermissions / hasAnyPermission', () => {
		it('does not authorize a permission the token claims but the current role does not grant', () => {
			setContext(demotedUser);
			expect(RequestContext.hasPermission(PermissionsEnum.SUPER_ADMIN_EDIT)).toBe(false);
			expect(RequestContext.hasAnyPermission([PermissionsEnum.SUPER_ADMIN_EDIT])).toBe(false);
		});

		it('authorizes the permissions the current role grants', () => {
			setContext(demotedUser);
			expect(RequestContext.hasPermission(PermissionsEnum.ORG_TEAM_VIEW)).toBe(true);
			expect(
				RequestContext.hasAnyPermission([PermissionsEnum.SUPER_ADMIN_EDIT, PermissionsEnum.ORG_TEAM_VIEW])
			).toBe(true);
		});

		it('requires every permission for hasPermissions', () => {
			setContext({ ...demotedUser, permissions: [PermissionsEnum.ORG_TEAM_VIEW] });
			expect(
				RequestContext.hasPermissions([PermissionsEnum.ORG_TEAM_VIEW, PermissionsEnum.ORG_USERS_EDIT])
			).toBe(false);
		});

		it('denies when the user carries no resolved permissions at all', () => {
			setContext({ id: 'user-1', tenantId: 'tenant-1', roleId: 'role-employee' });
			expect(RequestContext.hasPermission(PermissionsEnum.ORG_TEAM_VIEW)).toBe(false);
			expect(RequestContext.hasAnyPermission([PermissionsEnum.ORG_TEAM_VIEW])).toBe(false);
		});

		it('denies when there is no authenticated user, even with a valid token on the header', () => {
			setContext(undefined);
			expect(RequestContext.hasPermission(PermissionsEnum.SUPER_ADMIN_EDIT)).toBe(false);
			expect(RequestContext.hasAnyPermission([PermissionsEnum.SUPER_ADMIN_EDIT])).toBe(false);
		});

		it('throws when asked to and the permission is missing', () => {
			setContext(demotedUser);
			expect(() => RequestContext.hasPermission(PermissionsEnum.SUPER_ADMIN_EDIT, true)).toThrow(HttpException);
		});
	});

	describe('currentRoleName / currentPermissions', () => {
		it('reports the database role and permissions, not the claims', () => {
			setContext(demotedUser);
			expect(RequestContext.currentRoleName()).toBe(RolesEnum.EMPLOYEE);
			expect(RequestContext.currentPermissions()).toEqual([PermissionsEnum.ORG_TEAM_VIEW]);
		});

		it('reports nothing outside a request', () => {
			RequestContext.setClsService(undefined as any);
			expect(RequestContext.currentRoleName()).toBeNull();
			expect(RequestContext.currentPermissions()).toEqual([]);
		});
	});

	describe('currentEmployeeId', () => {
		/**
		 * currentEmployeeId() means "me" only for callers WITHOUT CHANGE_SELECTED_EMPLOYEE; for holders
		 * it means "the selected employee" and must stay null. That branch reads hasPermission, so it
		 * has to follow the database too.
		 */
		it('scopes a demoted user to their own employee record again', () => {
			setContext({ ...demotedUser, employeeId: 'employee-1' });
			expect(RequestContext.currentEmployeeId()).toBe('employee-1');
		});

		it('still returns null for a caller who really holds CHANGE_SELECTED_EMPLOYEE', () => {
			setContext({
				...demotedUser,
				employeeId: 'employee-1',
				permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]
			});
			expect(RequestContext.currentEmployeeId()).toBeNull();
		});
	});
});

/**
 * TASK 9 (improvement roadmap) — Unified Observability and Correlation IDs.
 *
 * `currentCorrelationId()` is a thin, better-named wrapper over the EXISTING `getContextId()`/
 * `setContextId()` machinery (already populated by `RequestContextMiddleware` — see
 * `request-context.middleware.spec.ts` for that side), so this asserts they really are the same
 * value, not just structurally similar.
 */
describe('RequestContext.currentCorrelationId', () => {
	const originalClsService = RequestContext['clsService'];
	const store = new Map<string, unknown>();

	beforeEach(() => {
		store.clear();
		RequestContext['clsService'] = {
			get: (key: string) => store.get(key),
			set: (key: string, value: unknown) => store.set(key, value)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any;
	});

	afterEach(() => {
		RequestContext['clsService'] = originalClsService;
	});

	it('returns null when no request context has been established', () => {
		expect(RequestContext.currentCorrelationId()).toBeNull();
	});

	it('returns the id a RequestContext was constructed with, identically to getContextId()', () => {
		new RequestContext({ id: 'correlation-abc' });

		expect(RequestContext.currentCorrelationId()).toBe('correlation-abc');
		expect(RequestContext.currentCorrelationId()).toBe(RequestContext.getContextId());
	});

	it('reflects a later setContextId() call (both accessors read the same underlying store)', () => {
		RequestContext.setContextId('correlation-xyz');

		expect(RequestContext.currentCorrelationId()).toBe('correlation-xyz');
	});
});
