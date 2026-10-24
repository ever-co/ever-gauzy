import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { environment as env } from '@gauzy/config';
import { PERMISSIONS_METADATA, ROLES_METADATA } from '@gauzy/constants';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { narrowPermissionsToOAuthAppScopes } from '../../auth/oauth-app-scope';
import { RequestContext } from './../../core/context';
import { PermissionGuard } from './permission.guard';
import { RoleGuard } from './role.guard';
import { TenantPermissionGuard } from './tenant-permission.guard';

// The guards only use the service as a DI token plus one method; loading the real one would pull in
// the whole entity graph for a unit test.
jest.mock('../../role-permission/role-permission.service', () => ({ RolePermissionService: class {} }));

/**
 * Owner decision Q12 (2026-10-24): a request authenticated by a third-party OAuth-app token is held to the scopes the
 * user approved. `JwtStrategy` pins the role's permissions narrowed to those scopes and records the grant on
 * `request.user` (`oauthApp`); the guards then refuse a permission outside the scopes — including on the role query
 * they fall back to — and every role check refuses the token, a super admin's included.
 */

const TENANT_ID = '1f3c5a7e-0000-4000-8000-000000000001';
const ROLE_ID = '1f3c5a7e-0000-4000-8000-0000000000aa';

/** The one environment switch these tests flip; restored after each test. */
const superAdminSwitch = env as unknown as { allowSuperAdminRole?: boolean };
const allowSuperAdminRole = superAdminSwitch.allowSuperAdminRole;

/** What the super admin's role holds in the database. */
const ROLE_PERMISSIONS = [
	PermissionsEnum.ALL_ORG_VIEW,
	PermissionsEnum.ALL_ORG_EDIT,
	PermissionsEnum.ORG_TASK_VIEW,
	PermissionsEnum.ORG_TASK_EDIT,
	PermissionsEnum.TENANT_SETTING
];

/**
 * The request user `JwtStrategy` leaves for a super admin: for an OAuth-app token, the role's permissions narrowed to
 * the approved scopes and the grant recorded; for a first-party session, the role's permissions as they are.
 */
function superAdmin(scopes?: string[], options: { attachPermissions?: boolean } = {}) {
	const attachPermissions = options.attachPermissions ?? true;
	return {
		id: 'user-1',
		tenantId: TENANT_ID,
		roleId: ROLE_ID,
		role: { id: ROLE_ID, name: RolesEnum.SUPER_ADMIN, tenantId: TENANT_ID },
		...(attachPermissions && {
			permissions: scopes ? narrowPermissionsToOAuthAppScopes(ROLE_PERMISSIONS, scopes) : ROLE_PERMISSIONS
		}),
		...(scopes && { oauthApp: { clientId: 'zapier-app', scopes } })
	};
}

/** Installs a request context whose authenticated user is `user`, as `RequestContextMiddleware` + JwtStrategy do. */
function actAs(user: unknown) {
	const store = new Map<string, unknown>();
	RequestContext.setClsService({
		get: (key: string) => store.get(key),
		set: (key: string, value: unknown) => store.set(key, value)
	} as any);
	store.set(RequestContext.name, new RequestContext({ req: { headers: {}, user } as any }));
}

/** The context a guard sees for a request whose `tenant-id` header names the caller's tenant (a GET by default). */
function contextFor(metadata: Record<string, unknown>, method = 'GET'): ExecutionContext {
	const handler = function handler(): void {
		return undefined;
	};
	class Controller {}
	for (const [key, value] of Object.entries(metadata)) {
		Reflect.defineMetadata(key, value, handler);
	}
	const request = {
		method,
		headers: { 'tenant-id': TENANT_ID },
		rawHeaders: ['tenant-id', TENANT_ID],
		query: {},
		body: {}
	};
	return {
		getType: () => 'http',
		getHandler: () => handler,
		getClass: () => Controller,
		switchToHttp: () => ({ getRequest: () => request })
	} as unknown as ExecutionContext;
}

function build() {
	const cacheManager = { get: jest.fn(async () => null), set: jest.fn(async () => undefined) };
	const rolePermissionService = { checkRolePermission: jest.fn(async () => true) };
	const reflector = new Reflector();
	return {
		permissionGuard: new PermissionGuard(cacheManager as any, reflector, rolePermissionService as any),
		tenantPermissionGuard: new TenantPermissionGuard(cacheManager as any, reflector, rolePermissionService as any),
		roleGuard: new RoleGuard(reflector),
		rolePermissionService
	};
}

beforeEach(() => {
	jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
	RequestContext.setClsService(undefined as any);
	superAdminSwitch.allowSuperAdminRole = allowSuperAdminRole;
	jest.restoreAllMocks();
});

describe('OAuth-app tokens at the guards (owner decision Q12)', () => {
	describe('PermissionGuard', () => {
		it('blocks a scoped token from a permission outside its scopes, though the role holds it', async () => {
			const { permissionGuard, rolePermissionService } = build();
			actAs(superAdmin(['zap']));

			await expect(
				permissionGuard.canActivate(contextFor({ [PERMISSIONS_METADATA]: [PermissionsEnum.ORG_TASK_EDIT] }))
			).resolves.toBe(false);
			expect(rolePermissionService.checkRolePermission).not.toHaveBeenCalled();
		});

		it('allows a permission inside its scopes that the role holds', async () => {
			const { permissionGuard } = build();
			actAs(superAdmin(['zap']));

			await expect(
				permissionGuard.canActivate(contextFor({ [PERMISSIONS_METADATA]: [PermissionsEnum.ORG_TASK_VIEW] }))
			).resolves.toBe(true);
		});

		it('never grants a reserved permission, even to a read and write token', async () => {
			const { permissionGuard } = build();
			actAs(superAdmin(['zap', 'zap:write']));

			await expect(
				permissionGuard.canActivate(contextFor({ [PERMISSIONS_METADATA]: [PermissionsEnum.TENANT_SETTING] }))
			).resolves.toBe(false);
		});

		it('asks the role query only about the permissions the scopes allow', async () => {
			// No attached permission list: the guard falls back to the role query, which knows nothing of scopes.
			const { permissionGuard, rolePermissionService } = build();
			actAs(superAdmin(['zap'], { attachPermissions: false }));

			await expect(
				permissionGuard.canActivate(
					contextFor({ [PERMISSIONS_METADATA]: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ALL_ORG_EDIT] })
				)
			).resolves.toBe(true);
			expect(rolePermissionService.checkRolePermission).toHaveBeenCalledWith(
				TENANT_ID,
				ROLE_ID,
				[PermissionsEnum.ALL_ORG_VIEW],
				true
			);

			rolePermissionService.checkRolePermission.mockClear();
			await expect(
				permissionGuard.canActivate(contextFor({ [PERMISSIONS_METADATA]: [PermissionsEnum.ALL_ORG_EDIT] }))
			).resolves.toBe(false);
			expect(rolePermissionService.checkRolePermission).not.toHaveBeenCalled();
		});

		it('refuses a write to a token without a write scope, even on a route that also accepts a read permission', async () => {
			// POST /timesheet/time-slot admits ALL_ORG_VIEW next to its write permissions.
			const { permissionGuard, rolePermissionService } = build();
			const declared = { [PERMISSIONS_METADATA]: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_EDIT] };
			actAs(superAdmin(['zap']));

			await expect(permissionGuard.canActivate(contextFor(declared, 'POST'))).resolves.toBe(false);
			expect(rolePermissionService.checkRolePermission).not.toHaveBeenCalled();

			// CONTROL: the same token reads through the same declaration, and a write-scoped token writes.
			await expect(permissionGuard.canActivate(contextFor(declared, 'GET'))).resolves.toBe(true);
			actAs(superAdmin(['zap', 'zap:write']));
			await expect(permissionGuard.canActivate(contextFor(declared, 'POST'))).resolves.toBe(true);
		});

		it('leaves a first-party session (and a legacy token without the claim) as it was', async () => {
			const { permissionGuard } = build();
			actAs(superAdmin());

			await expect(
				permissionGuard.canActivate(contextFor({ [PERMISSIONS_METADATA]: [PermissionsEnum.ORG_TASK_EDIT] }))
			).resolves.toBe(true);
		});
	});

	describe('RoleGuard', () => {
		it("refuses a role-only route to an OAuth-app token, a super admin's included", async () => {
			const { roleGuard } = build();
			actAs(superAdmin(['zap', 'zap:write']));

			await expect(
				roleGuard.canActivate(contextFor({ [ROLES_METADATA]: [RolesEnum.SUPER_ADMIN] }))
			).resolves.toBe(false);
			expect(RequestContext.hasRoles([RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN])).toBe(false);
		});

		it('still admits the same super admin in their own session', async () => {
			const { roleGuard } = build();
			actAs(superAdmin());

			await expect(
				roleGuard.canActivate(contextFor({ [ROLES_METADATA]: [RolesEnum.SUPER_ADMIN] }))
			).resolves.toBe(true);
			expect(RequestContext.hasRoles([RolesEnum.SUPER_ADMIN])).toBe(true);
		});

		it('lets an OAuth-app token through a route that declares no role', async () => {
			const { roleGuard } = build();
			actAs(superAdmin(['zap']));

			await expect(roleGuard.canActivate(contextFor({}))).resolves.toBe(true);
		});
	});

	describe('TenantPermissionGuard', () => {
		it('does not apply the super admin exemption to an OAuth-app token, and refuses outside the scopes', async () => {
			superAdminSwitch.allowSuperAdminRole = true;
			const { tenantPermissionGuard, rolePermissionService } = build();
			const context = contextFor({ [PERMISSIONS_METADATA]: [PermissionsEnum.TENANT_SETTING] });

			// CONTROL: the super admin's own session passes on the exemption alone.
			actAs(superAdmin());
			await expect(tenantPermissionGuard.canActivate(context)).resolves.toBe(true);

			actAs(superAdmin(['zap', 'zap:write']));
			await expect(tenantPermissionGuard.canActivate(context)).resolves.toBe(false);
			expect(rolePermissionService.checkRolePermission).not.toHaveBeenCalled();
		});

		it('refuses a write to a token without a write scope, even on a route that declares no permission', async () => {
			const { tenantPermissionGuard } = build();
			actAs(superAdmin(['zap']));

			await expect(tenantPermissionGuard.canActivate(contextFor({}, 'PUT'))).resolves.toBe(false);
			await expect(tenantPermissionGuard.canActivate(contextFor({}, 'GET'))).resolves.toBe(true);

			// A first-party session writes there as before.
			actAs(superAdmin());
			await expect(tenantPermissionGuard.canActivate(contextFor({}, 'PUT'))).resolves.toBe(true);
		});

		it('asks the role query only about the permissions the scopes allow', async () => {
			superAdminSwitch.allowSuperAdminRole = true;
			const { tenantPermissionGuard, rolePermissionService } = build();
			actAs(superAdmin(['zap']));

			await expect(
				tenantPermissionGuard.canActivate(
					contextFor({ [PERMISSIONS_METADATA]: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ALL_ORG_EDIT] })
				)
			).resolves.toBe(true);
			expect(rolePermissionService.checkRolePermission).toHaveBeenCalledWith(TENANT_ID, ROLE_ID, [
				PermissionsEnum.ALL_ORG_VIEW
			]);
		});
	});
});
