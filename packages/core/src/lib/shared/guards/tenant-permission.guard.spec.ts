import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { environment as env } from '@gauzy/config';
import { PERMISSIONS_METADATA, PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { ID, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { Cache } from 'cache-manager';
import { RequestContext } from './../../core/context';
import { RolePermissionService } from '../../role-permission/role-permission.service';
import { TenantBaseGuard } from './tenant-base.guard';
import { TenantPermissionGuard } from './tenant-permission.guard';

// The guard only uses the service as a DI token plus one method; loading the real one would pull in
// the whole entity graph for a unit test.
jest.mock('../../role-permission/role-permission.service', () => ({ RolePermissionService: class {} }));

/**
 * `TenantBaseGuard` + `TenantPermissionGuard` are the tenant-isolation gate on most controllers
 * (`@UseGuards(TenantPermissionGuard, PermissionGuard)`). Nothing exercised them before: every other
 * spec mocks or overrides them. This suite pins what they actually do today, so a change to either is
 * deliberate.
 */

const TENANT_ID = '1f3c5a7e-0000-4000-8000-000000000001';
const OTHER_TENANT_ID = '1f3c5a7e-0000-4000-8000-000000000002';
const ROLE_ID = '1f3c5a7e-0000-4000-8000-0000000000aa';

/** The one environment switch these tests flip; restored after each test. */
const superAdminSwitch = env as unknown as { allowSuperAdminRole?: boolean };

class ControllerStub {}

interface RequestShape {
	method?: string;
	headers?: Record<string, string>;
	rawHeaders?: string[];
	query?: Record<string, unknown>;
	body?: Record<string, unknown>;
}

/**
 * Builds the context a guard sees. `headerTenantId` sets BOTH the parsed header (Node lowercases the
 * name) and `rawHeaders` with the given raw casing, as a real request would.
 */
function contextFor(
	request: RequestShape & { headerTenantId?: string; rawHeaderName?: string },
	metadata: { handler?: Record<string, unknown>; controller?: Record<string, unknown> } = {}
): ExecutionContext {
	// A fresh function and class per context, so metadata defined for one test never leaks into another.
	const handler = function handler(): void {
		return undefined;
	};
	class Controller extends ControllerStub {}
	for (const [key, value] of Object.entries(metadata.handler ?? {})) Reflect.defineMetadata(key, value, handler);
	for (const [key, value] of Object.entries(metadata.controller ?? {}))
		Reflect.defineMetadata(key, value, Controller);

	let headers: Record<string, string> = { ...(request.headers ?? {}) };
	let rawHeaders: string[] = [...(request.rawHeaders ?? [])];
	if (request.headerTenantId !== undefined) {
		headers = { ...headers, 'tenant-id': request.headerTenantId };
		rawHeaders = [...rawHeaders, request.rawHeaderName ?? 'tenant-id', request.headerTenantId];
	}

	const httpRequest = {
		method: request.method ?? 'GET',
		headers,
		rawHeaders,
		query: request.query ?? {},
		body: request.body ?? {}
	};

	return {
		getType: () => 'http',
		getHandler: () => handler,
		getClass: () => Controller,
		switchToHttp: () => ({ getRequest: () => httpRequest })
	} as unknown as ExecutionContext;
}

function actAs(options: { tenantId?: string | null; roleId?: string | null; superAdmin?: boolean } = {}) {
	// `null` stands for "no tenant / no role in the token"; the accessors are typed as returning an ID.
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(
		(options.tenantId === undefined ? TENANT_ID : options.tenantId) as unknown as ID
	);
	jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue(
		(options.roleId === undefined ? ROLE_ID : options.roleId) as unknown as ID
	);
	jest.spyOn(RequestContext, 'hasRoles').mockImplementation(
		(roles: RolesEnum[]) => !!options.superAdmin && roles.includes(RolesEnum.SUPER_ADMIN)
	);
}

beforeEach(() => {
	// Both guards log every decision; keep the test output readable.
	jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('TenantBaseGuard', () => {
	const guard = new TenantBaseGuard();

	it('denies when the request context carries no tenant', async () => {
		actAs({ tenantId: null });
		await expect(guard.canActivate(contextFor({ headerTenantId: TENANT_ID }))).resolves.toBe(false);
	});

	describe('with a tenant-id header', () => {
		it('allows when the header names the caller’s tenant', async () => {
			actAs();
			await expect(guard.canActivate(contextFor({ headerTenantId: TENANT_ID }))).resolves.toBe(true);
		});

		it('also accepts the header sent as `Tenant-Id`', async () => {
			actAs();
			await expect(
				guard.canActivate(contextFor({ headerTenantId: TENANT_ID, rawHeaderName: 'Tenant-Id' }))
			).resolves.toBe(true);
		});

		it('denies when the header names another tenant', async () => {
			actAs();
			await expect(guard.canActivate(contextFor({ headerTenantId: OTHER_TENANT_ID }))).resolves.toBe(false);
		});

		it('does not look at a body or query tenantId once the header matches', async () => {
			// Current behaviour, pinned on purpose: the header is the whole check. A write that names
			// another tenant in its body passes this guard, so services must take the tenant from the
			// request context (as TenantAwareCrudService does), never from the payload.
			actAs();
			await expect(
				guard.canActivate(
					contextFor({
						method: 'POST',
						headerTenantId: TENANT_ID,
						body: { tenantId: OTHER_TENANT_ID },
						query: { tenantId: OTHER_TENANT_ID }
					})
				)
			).resolves.toBe(true);
		});
	});

	describe('without a tenant-id header, on reads (GET / DELETE)', () => {
		it.each(['GET', 'DELETE'])('%s allows a matching `tenantId` query parameter', async (method) => {
			actAs();
			await expect(guard.canActivate(contextFor({ method, query: { tenantId: TENANT_ID } }))).resolves.toBe(true);
		});

		it.each(['GET', 'DELETE'])('%s denies a `tenantId` query parameter naming another tenant', async (method) => {
			actAs();
			await expect(guard.canActivate(contextFor({ method, query: { tenantId: OTHER_TENANT_ID } }))).resolves.toBe(
				false
			);
		});

		it('denies a read that names no tenant at all', async () => {
			actAs();
			await expect(guard.canActivate(contextFor({ method: 'GET', query: {} }))).resolves.toBe(false);
		});

		it('allows a matching `data.findInput.tenantId`', async () => {
			actAs();
			const data = JSON.stringify({ findInput: { tenantId: TENANT_ID } });
			await expect(guard.canActivate(contextFor({ method: 'GET', query: { data } }))).resolves.toBe(true);
		});

		it('denies a `data.findInput.tenantId` naming another tenant', async () => {
			actAs();
			const data = JSON.stringify({ findInput: { tenantId: OTHER_TENANT_ID } });
			await expect(guard.canActivate(contextFor({ method: 'GET', query: { data } }))).resolves.toBe(false);
		});

		it('denies a `data` object with no `findInput.tenantId`', async () => {
			actAs();
			const data = JSON.stringify({ relations: ['employee'] });
			await expect(guard.canActivate(contextFor({ method: 'GET', query: { data } }))).resolves.toBe(false);
		});

		it('denies a `data` parameter that is not JSON', async () => {
			actAs();
			await expect(
				guard.canActivate(contextFor({ method: 'GET', query: { data: `tenantId=${TENANT_ID}` } }))
			).resolves.toBe(false);
		});
	});

	describe('without a tenant-id header, on writes (POST / PUT / PATCH)', () => {
		it.each(['POST', 'PUT', 'PATCH'])('%s allows a matching body `tenantId`', async (method) => {
			actAs();
			await expect(guard.canActivate(contextFor({ method, body: { tenantId: TENANT_ID } }))).resolves.toBe(true);
		});

		it.each(['POST', 'PUT', 'PATCH'])('%s denies a body `tenantId` naming another tenant', async (method) => {
			actAs();
			await expect(guard.canActivate(contextFor({ method, body: { tenantId: OTHER_TENANT_ID } }))).resolves.toBe(
				false
			);
		});

		it('allows a matching body `tenant.id`', async () => {
			actAs();
			await expect(
				guard.canActivate(contextFor({ method: 'POST', body: { tenant: { id: TENANT_ID } } }))
			).resolves.toBe(true);
		});

		it('denies a write whose body names no tenant', async () => {
			actAs();
			await expect(guard.canActivate(contextFor({ method: 'POST', body: { name: 'x' } }))).resolves.toBe(false);
		});
	});

	it('denies any other method that carries no tenant-id header', async () => {
		actAs();
		await expect(
			guard.canActivate(contextFor({ method: 'OPTIONS', query: { tenantId: TENANT_ID } }))
		).resolves.toBe(false);
	});
});

describe('TenantPermissionGuard', () => {
	let cache: Map<string, unknown>;
	let cacheManager: { get: jest.Mock; set: jest.Mock };
	let rolePermissionService: { checkRolePermission: jest.Mock };
	let guard: TenantPermissionGuard;
	let previousAllowSuperAdmin: boolean | undefined;

	beforeEach(() => {
		cache = new Map();
		cacheManager = {
			get: jest.fn(async (key: string) => (cache.has(key) ? cache.get(key) : null)),
			set: jest.fn(async (key: string, value: unknown) => void cache.set(key, value))
		};
		rolePermissionService = { checkRolePermission: jest.fn() };
		guard = new TenantPermissionGuard(
			cacheManager as unknown as Cache,
			new Reflector(),
			rolePermissionService as unknown as RolePermissionService
		);
		previousAllowSuperAdmin = superAdminSwitch.allowSuperAdminRole;
	});

	afterEach(() => {
		superAdminSwitch.allowSuperAdminRole = previousAllowSuperAdmin;
	});

	const withPermissions = (handler?: PermissionsEnum[], controller?: PermissionsEnum[]) => ({
		...(handler ? { handler: { [PERMISSIONS_METADATA]: handler } } : {}),
		...(controller ? { controller: { [PERMISSIONS_METADATA]: controller } } : {})
	});

	describe('@Public routes', () => {
		it('allows a public handler without a tenant or any check', async () => {
			actAs({ tenantId: null });
			const context = contextFor({}, { handler: { [PUBLIC_METHOD_METADATA]: true } });
			await expect(guard.canActivate(context)).resolves.toBe(true);
			expect(rolePermissionService.checkRolePermission).not.toHaveBeenCalled();
		});

		it('allows every handler of a public controller', async () => {
			actAs({ tenantId: null });
			const context = contextFor({}, { controller: { [PUBLIC_METHOD_METADATA]: true } });
			await expect(guard.canActivate(context)).resolves.toBe(true);
		});
	});

	it('denies when the request context carries no tenant, without checking permissions', async () => {
		actAs({ tenantId: null });
		const context = contextFor(
			{ headerTenantId: TENANT_ID },
			withPermissions([PermissionsEnum.ORG_EMPLOYEES_VIEW])
		);
		await expect(guard.canActivate(context)).resolves.toBe(false);
		expect(rolePermissionService.checkRolePermission).not.toHaveBeenCalled();
	});

	it('denies when the tenant check fails, before permissions are consulted — even for a super admin', async () => {
		superAdminSwitch.allowSuperAdminRole = true;
		actAs({ superAdmin: true });
		const context = contextFor(
			{ headerTenantId: OTHER_TENANT_ID },
			withPermissions([PermissionsEnum.ORG_EMPLOYEES_VIEW])
		);
		await expect(guard.canActivate(context)).resolves.toBe(false);
		expect(rolePermissionService.checkRolePermission).not.toHaveBeenCalled();
	});

	it('allows a route that declares no permissions once the tenant check passes', async () => {
		actAs();
		await expect(guard.canActivate(contextFor({ headerTenantId: TENANT_ID }))).resolves.toBe(true);
		expect(rolePermissionService.checkRolePermission).not.toHaveBeenCalled();
	});

	describe('super admin', () => {
		it('skips the permission check while `allowSuperAdminRole` is on', async () => {
			superAdminSwitch.allowSuperAdminRole = true;
			actAs({ superAdmin: true });
			const context = contextFor(
				{ headerTenantId: TENANT_ID },
				withPermissions([PermissionsEnum.ORG_EMPLOYEES_EDIT])
			);
			await expect(guard.canActivate(context)).resolves.toBe(true);
			expect(rolePermissionService.checkRolePermission).not.toHaveBeenCalled();
		});

		it('is checked like any other role while `allowSuperAdminRole` is off', async () => {
			superAdminSwitch.allowSuperAdminRole = false;
			actAs({ superAdmin: true });
			rolePermissionService.checkRolePermission.mockResolvedValue(false);
			const context = contextFor(
				{ headerTenantId: TENANT_ID },
				withPermissions([PermissionsEnum.ORG_EMPLOYEES_EDIT])
			);
			await expect(guard.canActivate(context)).resolves.toBe(false);
			expect(rolePermissionService.checkRolePermission).toHaveBeenCalledTimes(1);
		});
	});

	describe('declared permissions', () => {
		it.each([true, false])(
			'on a cache miss, asks the role-permission service and returns its answer (%s)',
			async (granted) => {
				actAs();
				rolePermissionService.checkRolePermission.mockResolvedValue(granted);
				const permissions = [PermissionsEnum.ORG_EMPLOYEES_VIEW, PermissionsEnum.ORG_EMPLOYEES_EDIT];
				const context = contextFor({ headerTenantId: TENANT_ID }, withPermissions(permissions));

				await expect(guard.canActivate(context)).resolves.toBe(granted);
				expect(rolePermissionService.checkRolePermission).toHaveBeenCalledWith(TENANT_ID, ROLE_ID, permissions);
			}
		);

		it('caches the answer for five minutes under a tenant + role + permissions key', async () => {
			actAs();
			rolePermissionService.checkRolePermission.mockResolvedValue(true);
			const permissions = [PermissionsEnum.ORG_EMPLOYEES_VIEW, PermissionsEnum.ORG_EMPLOYEES_EDIT];
			await guard.canActivate(contextFor({ headerTenantId: TENANT_ID }, withPermissions(permissions)));

			expect(cacheManager.set).toHaveBeenCalledWith(
				`tenantPermissions_${TENANT_ID}_${ROLE_ID}_${permissions.join('_')}`,
				true,
				5 * 60 * 1000
			);
		});

		it.each([true, false])('uses a cached answer (%s) without asking the service again', async (cached) => {
			actAs();
			const permissions = [PermissionsEnum.ORG_EMPLOYEES_VIEW];
			cache.set(`tenantPermissions_${TENANT_ID}_${ROLE_ID}_${permissions.join('_')}`, cached);

			await expect(
				guard.canActivate(contextFor({ headerTenantId: TENANT_ID }, withPermissions(permissions)))
			).resolves.toBe(cached);
			expect(rolePermissionService.checkRolePermission).not.toHaveBeenCalled();
		});

		it('keys the cache by role, so another role in the same tenant is asked afresh', async () => {
			const permissions = [PermissionsEnum.ORG_EMPLOYEES_VIEW];
			cache.set(`tenantPermissions_${TENANT_ID}_${ROLE_ID}_${permissions.join('_')}`, true);
			actAs({ roleId: 'another-role' });
			rolePermissionService.checkRolePermission.mockResolvedValue(false);

			await expect(
				guard.canActivate(contextFor({ headerTenantId: TENANT_ID }, withPermissions(permissions)))
			).resolves.toBe(false);
			expect(rolePermissionService.checkRolePermission).toHaveBeenCalledWith(
				TENANT_ID,
				'another-role',
				permissions
			);
		});

		it('lets handler-level permissions override the controller’s', async () => {
			actAs();
			rolePermissionService.checkRolePermission.mockResolvedValue(true);
			const context = contextFor(
				{ headerTenantId: TENANT_ID },
				withPermissions([PermissionsEnum.ORG_EMPLOYEES_EDIT], [PermissionsEnum.ORG_EMPLOYEES_VIEW])
			);

			await guard.canActivate(context);
			expect(rolePermissionService.checkRolePermission).toHaveBeenCalledWith(TENANT_ID, ROLE_ID, [
				PermissionsEnum.ORG_EMPLOYEES_EDIT
			]);
		});

		it('falls back to the controller’s permissions when the handler declares none', async () => {
			actAs();
			rolePermissionService.checkRolePermission.mockResolvedValue(true);
			const context = contextFor(
				{ headerTenantId: TENANT_ID },
				withPermissions(undefined, [PermissionsEnum.ORG_EMPLOYEES_VIEW])
			);

			await guard.canActivate(context);
			expect(rolePermissionService.checkRolePermission).toHaveBeenCalledWith(TENANT_ID, ROLE_ID, [
				PermissionsEnum.ORG_EMPLOYEES_VIEW
			]);
		});

		it('de-duplicates repeated permissions before checking and keying the cache', async () => {
			actAs();
			rolePermissionService.checkRolePermission.mockResolvedValue(true);
			const context = contextFor(
				{ headerTenantId: TENANT_ID },
				withPermissions([PermissionsEnum.ORG_EMPLOYEES_VIEW, PermissionsEnum.ORG_EMPLOYEES_VIEW])
			);

			await guard.canActivate(context);
			expect(rolePermissionService.checkRolePermission).toHaveBeenCalledWith(TENANT_ID, ROLE_ID, [
				PermissionsEnum.ORG_EMPLOYEES_VIEW
			]);
			expect(cacheManager.set.mock.calls[0][0]).toBe(
				`tenantPermissions_${TENANT_ID}_${ROLE_ID}_${PermissionsEnum.ORG_EMPLOYEES_VIEW}`
			);
		});
	});
});
