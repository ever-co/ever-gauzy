import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { ID, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from './../../core/context';
import { PermissionGuard } from './permission.guard';

// The guard only uses the service as a DI token plus one method; loading the real one would pull in
// the whole entity graph for a unit test.
jest.mock('../../role-permission/role-permission.service', () => ({ RolePermissionService: class {} }));

/**
 * `PermissionGuard` decides a route's `@Permissions(...)` for the caller's role. Since `JwtStrategy` pins
 * the role's database-fresh permissions onto `request.user`, the guard reads them from there; the
 * 5-minute cache and the `checkRolePermission` query remain for a request without that state.
 */

const TENANT_ID = '1f3c5a7e-0000-4000-8000-000000000001';
const ROLE_ID = '1f3c5a7e-0000-4000-8000-0000000000aa';
const REQUIRED = [PermissionsEnum.ORG_TEAM_EDIT, PermissionsEnum.ALL_ORG_EDIT];

function contextFor(permissions: PermissionsEnum[] | undefined): ExecutionContext {
	const handler = function handler(): void {
		return undefined;
	};
	class Controller {}
	if (permissions) {
		Reflect.defineMetadata(PERMISSIONS_METADATA, permissions, handler);
	}
	return {
		getType: () => 'http',
		getHandler: () => handler,
		getClass: () => Controller,
		switchToHttp: () => ({ getRequest: () => ({ headers: {} }) })
	} as unknown as ExecutionContext;
}

function build() {
	const cache = new Map<string, boolean>();
	const cacheManager = {
		get: jest.fn(async (key: string) => cache.get(key) ?? null),
		set: jest.fn(async (key: string, value: boolean) => {
			cache.set(key, value);
		})
	};
	const rolePermissionService = { checkRolePermission: jest.fn(async () => true) };
	const guard = new PermissionGuard(cacheManager as any, new Reflector(), rolePermissionService as any);
	return { guard, cacheManager, rolePermissionService };
}

/** The request's user: the shape `JwtStrategy` + `RoleAuthorizationService` leave on `request.user`. */
function actAs(user: Record<string, unknown> | null) {
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue(user as any);
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(
		((user?.tenantId as string) ?? null) as unknown as ID
	);
	jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue(((user?.roleId as string) ?? null) as unknown as ID);
	jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(((user?.id as string) ?? null) as unknown as ID);
	jest.spyOn(RequestContext, 'currentRoleName').mockReturnValue(
		((user?.role as { name?: RolesEnum } | undefined)?.name ?? null) as RolesEnum
	);
}

const attachedUser = (permissions: PermissionsEnum[]) => ({
	id: 'user-1',
	tenantId: TENANT_ID,
	roleId: ROLE_ID,
	role: { id: ROLE_ID, name: RolesEnum.EMPLOYEE, tenantId: TENANT_ID },
	permissions
});

beforeEach(() => {
	jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('PermissionGuard', () => {
	it('authorizes a route without permission metadata', async () => {
		const { guard, cacheManager, rolePermissionService } = build();
		actAs(attachedUser([]));

		await expect(guard.canActivate(contextFor(undefined))).resolves.toBe(true);
		expect(cacheManager.get).not.toHaveBeenCalled();
		expect(rolePermissionService.checkRolePermission).not.toHaveBeenCalled();
	});

	describe('with the role state attached to the request', () => {
		it('grants from the attached permissions, without the cache or the query', async () => {
			const { guard, cacheManager, rolePermissionService } = build();
			actAs(attachedUser([PermissionsEnum.ORG_TEAM_EDIT]));

			await expect(guard.canActivate(contextFor(REQUIRED))).resolves.toBe(true);
			expect(cacheManager.get).not.toHaveBeenCalled();
			expect(cacheManager.set).not.toHaveBeenCalled();
			expect(rolePermissionService.checkRolePermission).not.toHaveBeenCalled();
		});

		it('denies from the attached permissions, even when the query would grant', async () => {
			// A demotion is on the request at once; the 5-minute cache and the query are never consulted.
			const { guard, rolePermissionService } = build();
			rolePermissionService.checkRolePermission.mockResolvedValue(true);
			actAs(attachedUser([PermissionsEnum.PROFILE_EDIT]));

			await expect(guard.canActivate(contextFor(REQUIRED))).resolves.toBe(false);
			expect(rolePermissionService.checkRolePermission).not.toHaveBeenCalled();
		});

		it('denies a user whose role could not be resolved', async () => {
			const { guard, rolePermissionService } = build();
			actAs({ id: 'user-1', tenantId: TENANT_ID, roleId: ROLE_ID, permissions: [] });

			await expect(guard.canActivate(contextFor(REQUIRED))).resolves.toBe(false);
			expect(rolePermissionService.checkRolePermission).not.toHaveBeenCalled();
		});
	});

	describe('without the attached state', () => {
		it('asks the database once and caches the verdict for the tenant, role and permissions', async () => {
			const { guard, cacheManager, rolePermissionService } = build();
			actAs({ id: 'user-1', tenantId: TENANT_ID, roleId: ROLE_ID, role: { name: RolesEnum.EMPLOYEE } });

			await expect(guard.canActivate(contextFor(REQUIRED))).resolves.toBe(true);
			await expect(guard.canActivate(contextFor(REQUIRED))).resolves.toBe(true);

			expect(rolePermissionService.checkRolePermission).toHaveBeenCalledTimes(1);
			expect(rolePermissionService.checkRolePermission).toHaveBeenCalledWith(TENANT_ID, ROLE_ID, REQUIRED, true);
			expect(cacheManager.set).toHaveBeenCalledWith(
				`userPermissions_${TENANT_ID}_${ROLE_ID}_${REQUIRED.join('_')}`,
				true,
				5 * 60 * 1000
			);
		});

		it('leaves a role of another tenant to the tenant-scoped query', async () => {
			const { guard, rolePermissionService } = build();
			rolePermissionService.checkRolePermission.mockResolvedValue(false);
			actAs({ ...attachedUser([PermissionsEnum.ORG_TEAM_EDIT]), role: { id: ROLE_ID, tenantId: 'other' } });

			await expect(guard.canActivate(contextFor(REQUIRED))).resolves.toBe(false);
			expect(rolePermissionService.checkRolePermission).toHaveBeenCalledTimes(1);
		});
	});
});
