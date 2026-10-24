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
		// A body stated as `undefined` stays undefined: Express 5 leaves `req.body` unset when nothing parsed one.
		body: 'body' in request ? request.body : {}
	};

	return {
		getType: () => 'http',
		getHandler: () => handler,
		getClass: () => Controller,
		switchToHttp: () => ({ getRequest: () => httpRequest })
	} as unknown as ExecutionContext;
}

/**
 * Builds the context a guard sees for a GraphQL operation: `[root, args, context, info]`, where the driver's
 * context carries the HTTP request as `req`. There is no HTTP request to switch to, so asking for one throws.
 */
function graphqlContextFor(
	headers: Record<string, string> = {},
	metadata: { handler?: Record<string, unknown>; controller?: Record<string, unknown> } = {}
): ExecutionContext {
	const handler = function field(): void {
		return undefined;
	};
	class Resolver {}
	for (const [key, value] of Object.entries(metadata.handler ?? {})) Reflect.defineMetadata(key, value, handler);
	for (const [key, value] of Object.entries(metadata.controller ?? {})) Reflect.defineMetadata(key, value, Resolver);

	const args = [undefined, {}, { req: { headers } }, { fieldName: 'field' }];

	return {
		getType: () => 'graphql',
		getArgs: () => args,
		getArgByIndex: (index: number) => args[index],
		getHandler: () => handler,
		getClass: () => Resolver,
		switchToHttp: () => {
			throw new Error('A GraphQL operation has no HTTP request.');
		}
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

		it('denies a body or query that names another tenant, even when the header matches (SEC-A-03, SEC-D-12)', async () => {
			// The header used to be the whole check, on the assumption that services take the tenant from the
			// request context — and `TenantAwareCrudService.update` wrote the payload's tenantId as given, so
			// `PUT` + header A + body {"tenantId": B} re-tenanted the caller's own row. A request that states
			// another tenant anywhere is refused.
			actAs();
			for (const request of [
				{ method: 'POST', body: { tenantId: OTHER_TENANT_ID } },
				{ method: 'PUT', body: { tenant: { id: OTHER_TENANT_ID } } },
				{ method: 'POST', body: [{ tenantId: TENANT_ID }, { tenantId: OTHER_TENANT_ID }] },
				{ method: 'GET', query: { tenantId: OTHER_TENANT_ID } },
				// The read shape the no-header path checks too (CodeRabbit on #10647).
				{ method: 'GET', query: { data: JSON.stringify({ findInput: { tenantId: OTHER_TENANT_ID } }) } }
			]) {
				await expect(guard.canActivate(contextFor({ ...request, headerTenantId: TENANT_ID } as any))).resolves.toBe(
					false
				);
			}
		});

		it('allows a body or query that names the caller’s own tenant, or none, when the header matches', async () => {
			actAs();
			for (const request of [
				{ method: 'POST', body: { tenantId: TENANT_ID, name: 'x' } },
				{ method: 'PUT', body: { name: 'x' } },
				{ method: 'POST', body: [{ tenantId: TENANT_ID }, { name: 'y' }] },
				{ method: 'GET', query: { tenantId: TENANT_ID } },
				{ method: 'GET', query: { data: JSON.stringify({ findInput: { tenantId: TENANT_ID } }) } },
				{ method: 'GET', query: { data: JSON.stringify({ findInput: { name: 'x' } }) } }
			]) {
				await expect(guard.canActivate(contextFor({ ...request, headerTenantId: TENANT_ID } as any))).resolves.toBe(
					true
				);
			}
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

	describe('on a GraphQL operation', () => {
		// An operation carries no query string and its payload is shaped by the operation, not by a `tenantId`
		// member, so only the credential and the `tenant-id` header are compared.
		it('denies when the request context carries no tenant', async () => {
			actAs({ tenantId: null });
			await expect(guard.canActivate(graphqlContextFor({ 'tenant-id': TENANT_ID }))).resolves.toBe(false);
		});

		it('allows an operation that states no tenant: the credential is the only scope it has', async () => {
			actAs();
			await expect(guard.canActivate(graphqlContextFor())).resolves.toBe(true);
		});

		it('allows a `tenant-id` header naming the caller’s tenant', async () => {
			actAs();
			await expect(guard.canActivate(graphqlContextFor({ 'tenant-id': TENANT_ID }))).resolves.toBe(true);
		});

		it('denies a `tenant-id` header naming another tenant', async () => {
			actAs();
			await expect(guard.canActivate(graphqlContextFor({ 'tenant-id': OTHER_TENANT_ID }))).resolves.toBe(false);
		});
	});

	/**
	 * What the guard does today where that looks wrong. Pinned as it is, not fixed: each is a follow-up on the
	 * pull request that added these cases, and a fix flips the expectation deliberately. Each is a place where
	 * the path without a header is weaker than the header path, or where a refusal is answered as a crash.
	 */
	describe('as it is today, where it looks wrong (follow-ups, not fixed here)', () => {
		it('reads a header spelled other than `tenant-id` or `Tenant-Id` as no header at all', async () => {
			// Node lowercases header names, so `headers['tenant-id']` holds the value whatever the spelling, but the
			// guard only believes it when `rawHeaders` has one of those two spellings. `TENANT-ID: <another tenant>`
			// on a write whose body names the caller's tenant is judged as a request without a header, and allowed.
			actAs();
			const request = { method: 'POST', body: { tenantId: TENANT_ID }, headerTenantId: OTHER_TENANT_ID };
			await expect(guard.canActivate(contextFor({ ...request, rawHeaderName: 'TENANT-ID' }))).resolves.toBe(true);
			// Control: the same request with the header spelled as the guard expects is refused.
			await expect(guard.canActivate(contextFor(request))).resolves.toBe(false);
		});

		it('without a header, compares one tenant field and ignores any other the request names', async () => {
			// The header path refuses a request that names another tenant anywhere (SEC-A-03, SEC-D-12). The path
			// without a header compares one field — the query's on a read, the body's `tenantId` (else `tenant.id`)
			// on a write — so each of these is allowed without a header and refused with a matching one.
			actAs();
			const requests = [
				{ method: 'POST', body: { tenantId: TENANT_ID, tenant: { id: OTHER_TENANT_ID } } },
				{ method: 'PUT', query: { tenantId: OTHER_TENANT_ID }, body: { tenantId: TENANT_ID } },
				{ method: 'DELETE', query: { tenantId: TENANT_ID }, body: { tenantId: OTHER_TENANT_ID } }
			];
			for (const request of requests) {
				await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
				await expect(guard.canActivate(contextFor({ ...request, headerTenantId: TENANT_ID }))).resolves.toBe(
					false
				);
			}
		});

		it('throws, instead of refusing, a headerless write with no parsed body or with `tenant: null`', async () => {
			// `'tenantId' in body` throws when there is no body, and `body.tenant.id` throws when `tenant` is null.
			// Nothing gets through either way, but the caller is answered 500 rather than 403.
			actAs();
			const withoutBody = contextFor({ method: 'POST', body: undefined });
			const nullTenant = contextFor({ method: 'PATCH', body: { tenant: null } });
			await expect(guard.canActivate(withoutBody)).rejects.toThrow(TypeError);
			await expect(guard.canActivate(nullTenant)).rejects.toThrow(TypeError);
		});
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

		it('is denied, like anyone, when the request context carries no tenant', async () => {
			// The tenant comes first: the switch skips the permission step, never the tenant check.
			superAdminSwitch.allowSuperAdminRole = true;
			actAs({ tenantId: null, superAdmin: true });
			const permissions = [PermissionsEnum.ORG_EMPLOYEES_VIEW];
			const context = contextFor({ headerTenantId: TENANT_ID }, withPermissions(permissions));
			await expect(guard.canActivate(context)).resolves.toBe(false);
			expect(rolePermissionService.checkRolePermission).not.toHaveBeenCalled();
		});
	});

	describe('on a GraphQL operation', () => {
		it('denies a `tenant-id` header naming another tenant before permissions are consulted', async () => {
			actAs();
			const permissions = [PermissionsEnum.ORG_EMPLOYEES_VIEW];
			const context = graphqlContextFor({ 'tenant-id': OTHER_TENANT_ID }, withPermissions(permissions));
			await expect(guard.canActivate(context)).resolves.toBe(false);
			expect(rolePermissionService.checkRolePermission).not.toHaveBeenCalled();
		});

		it('checks the declared permissions of an operation that states no tenant', async () => {
			actAs();
			rolePermissionService.checkRolePermission.mockResolvedValue(false);
			const permissions = [PermissionsEnum.ORG_EMPLOYEES_VIEW];
			await expect(guard.canActivate(graphqlContextFor({}, withPermissions(permissions)))).resolves.toBe(false);
			expect(rolePermissionService.checkRolePermission).toHaveBeenCalledWith(TENANT_ID, ROLE_ID, permissions);
		});
	});

	it('checks a credential that carries no role tenant-wide, like any other', async () => {
		// The permission step asks whether the tenant grants the permissions at all — the service is called
		// without `includeRole`, and the caller's own role is `PermissionGuard`'s to check — so a missing role is
		// passed on as it is and becomes part of the cache key.
		actAs({ roleId: null });
		rolePermissionService.checkRolePermission.mockResolvedValue(true);
		const permissions = [PermissionsEnum.ORG_EMPLOYEES_VIEW];

		await expect(
			guard.canActivate(contextFor({ headerTenantId: TENANT_ID }, withPermissions(permissions)))
		).resolves.toBe(true);
		expect(rolePermissionService.checkRolePermission).toHaveBeenCalledWith(TENANT_ID, null, permissions);
		expect(cacheManager.set.mock.calls[0][0]).toBe(`tenantPermissions_${TENANT_ID}_null_${permissions.join('_')}`);
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
