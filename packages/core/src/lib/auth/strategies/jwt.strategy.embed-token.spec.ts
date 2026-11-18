import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { IRole, PermissionsEnum, RolesEnum } from '@gauzy/contracts';

// The strategy and the guards only need these for DI metadata; loading the real modules drags in the whole core
// entity graph, which cannot be required in isolation (pre-existing circular import).
jest.mock('../auth.service', () => ({ AuthService: class AuthService {} }));
jest.mock('../../employee/employee.service', () => ({ EmployeeService: class EmployeeService {} }));
jest.mock('../../user-organization/user-organization.services', () => ({
	UserOrganizationService: class UserOrganizationService {}
}));
jest.mock('../../role/role-authorization.service', () => ({
	RoleAuthorizationService: class RoleAuthorizationService {}
}));
jest.mock('../../role-permission/role-permission.service', () => ({ RolePermissionService: class {} }));

import { RequestContext } from '../../core/context';
import { currentOrganizationBoundary } from '../../core/crud/organization-boundary';
import { IAuthenticatedUser } from '../../core/context/types';
import { EMBED_CREDENTIAL_CLAIM, EMBED_EMPLOYEE_CLAIM, EMBED_TOKEN_PERMISSIONS } from '../../embed/embed-session';
import { DEFAULT_ROLE_PERMISSIONS } from '../../role-permission/default-role-permissions';
import { PermissionGuard } from '../../shared/guards/permission.guard';
import { TenantPermissionGuard } from '../../shared/guards/tenant-permission.guard';
import { AuthenticatedUserCache } from './authenticated-user-cache';
import { JwtStrategy } from './jwt.strategy';

/**
 * An embed token (`embed/`) acts for one member on the timer routes, with the permissions those routes need and no
 * more: its role's permissions intersected with `TIME_TRACKER` and `ORG_TEAM_VIEW`. An administrator's token loses
 * `ALL_ORG_VIEW`, `CHANGE_SELECTED_EMPLOYEE` and the rest at every check: `RequestContext`, the permission guards, and
 * the role queries they fall back to. A token of the same user without the embed claims keeps everything.
 */

const TENANT = '7b000000-0000-4000-8000-0000000000a1';
const OTHER_TENANT = '7b000000-0000-4000-8000-0000000000a2';
const ORG = '7b000000-0000-4000-8000-0000000000f1';
const EMPLOYEE = '7b000000-0000-4000-8000-0000000000e1';
const CREDENTIAL = '7b000000-0000-4000-8000-0000000000c1';
const ROLE_ID = '7b000000-0000-4000-8000-0000000000b1';

const firstPartyPayload = { id: 'user-1', tenantId: TENANT, organizationId: ORG, employeeId: EMPLOYEE };
const embedPayload = { ...firstPartyPayload, [EMBED_CREDENTIAL_CLAIM]: CREDENTIAL, [EMBED_EMPLOYEE_CLAIM]: EMPLOYEE };

/** The permissions a default role is seeded with. */
function defaultPermissionsOf(role: RolesEnum): PermissionsEnum[] {
	const entry = DEFAULT_ROLE_PERMISSIONS.find((candidate) => candidate.role === role);
	return [...(entry?.defaultEnabledPermissions ?? [])];
}

const ADMIN_PERMISSIONS = defaultPermissionsOf(RolesEnum.ADMIN);

/** The routes an embed token reaches, with the permissions they declare. */
const TIMER_START = [PermissionsEnum.TIME_TRACKER];
const TIMER_STATUS = [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_TRACKER];
const MY_TEAMS = [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW];

/**
 * A strategy whose user holds `permissions` through a role named `roleName`, filed under `roleTenantId` (the
 * request's tenant unless a test says otherwise).
 */
function strategyFor(
	roleName: RolesEnum,
	permissions: PermissionsEnum[],
	options: { roleTenantId?: string; cache?: AuthenticatedUserCache } = {}
) {
	const authService = {
		getAuthenticatedUser: jest.fn(async () => ({
			id: 'user-1',
			tenantId: TENANT,
			roleId: ROLE_ID,
			isActive: true,
			isArchived: false
		}))
	};
	const roleAuthorizationService = {
		attachAuthorizationState: jest.fn(async (user: IAuthenticatedUser) => {
			user.role = { id: ROLE_ID, name: roleName, tenantId: options.roleTenantId ?? TENANT } as IRole;
			user.permissions = permissions;
			return user;
		})
	};
	const employeeService = {
		findOneByIdString: jest.fn(async () => ({
			id: EMPLOYEE,
			userId: 'user-1',
			organizationId: ORG,
			isActive: true,
			isArchived: false
		}))
	};
	const userOrganizationService = { findOneByOptions: jest.fn(async () => ({ id: 'membership-1' })) };
	const strategy = new JwtStrategy(
		authService as any,
		employeeService as any,
		userOrganizationService as any,
		roleAuthorizationService as any,
		options.cache ?? new AuthenticatedUserCache({ ttlMs: 0, ormType: 'typeorm' })
	);
	return { strategy, authService };
}

/** Installs a request context whose authenticated user is `user`, as `RequestContextMiddleware` + JwtStrategy do. */
function actAs(user: IAuthenticatedUser) {
	const store = new Map<string, unknown>();
	RequestContext.setClsService({
		get: (key: string) => store.get(key),
		set: (key: string, value: unknown) => store.set(key, value)
	} as any);
	store.set(RequestContext.name, new RequestContext({ req: { headers: {}, user } as any }));
}

/** The context a guard sees for a route declaring `permissions`, whose `tenant-id` header names the caller's tenant. */
function routeDeclaring(permissions: PermissionsEnum[], method = 'GET'): ExecutionContext {
	const handler = function handler(): void {
		return undefined;
	};
	class Controller {}
	Reflect.defineMetadata(PERMISSIONS_METADATA, permissions, handler);
	const request = {
		method,
		headers: { 'tenant-id': TENANT },
		rawHeaders: ['tenant-id', TENANT],
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

/** The guards, with a role query that grants whatever it is asked. */
function guards() {
	const cacheManager = { get: jest.fn(async () => null), set: jest.fn(async () => undefined) };
	const rolePermissionService = { checkRolePermission: jest.fn(async () => true) };
	const reflector = new Reflector();
	return {
		permissionGuard: new PermissionGuard(cacheManager as any, reflector, rolePermissionService as any),
		tenantPermissionGuard: new TenantPermissionGuard(cacheManager as any, reflector, rolePermissionService as any),
		rolePermissionService
	};
}

const sorted = (permissions: readonly PermissionsEnum[] | undefined) => [...(permissions ?? [])].sort();

beforeEach(() => {
	jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
	RequestContext.setClsService(undefined as any);
	jest.restoreAllMocks();
});

describe('JwtStrategy: an embed token acts with the timer and team permissions only', () => {
	it('names the permissions the embed routes need', () => {
		expect(sorted(EMBED_TOKEN_PERMISSIONS)).toEqual(
			sorted([PermissionsEnum.TIME_TRACKER, PermissionsEnum.ORG_TEAM_VIEW])
		);
	});

	it("narrows an administrator's embed token to the role's TIME_TRACKER and ORG_TEAM_VIEW", async () => {
		const { strategy } = strategyFor(RolesEnum.ADMIN, ADMIN_PERMISSIONS);

		const user = await strategy.validate(embedPayload);

		expect(sorted(user.permissions)).toEqual(sorted([PermissionsEnum.TIME_TRACKER, PermissionsEnum.ORG_TEAM_VIEW]));
	});

	it("passes the timer start route's check, and refuses CHANGE_SELECTED_EMPLOYEE and ALL_ORG_VIEW", async () => {
		const { strategy } = strategyFor(RolesEnum.ADMIN, ADMIN_PERMISSIONS);
		const { permissionGuard, tenantPermissionGuard, rolePermissionService } = guards();
		actAs(await strategy.validate(embedPayload));

		await expect(tenantPermissionGuard.canActivate(routeDeclaring(TIMER_START, 'POST'))).resolves.toBe(true);
		await expect(permissionGuard.canActivate(routeDeclaring(TIMER_START, 'POST'))).resolves.toBe(true);
		await expect(permissionGuard.canActivate(routeDeclaring(TIMER_STATUS))).resolves.toBe(true);
		await expect(permissionGuard.canActivate(routeDeclaring(MY_TEAMS))).resolves.toBe(true);

		await expect(
			permissionGuard.canActivate(routeDeclaring([PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]))
		).resolves.toBe(false);
		await expect(permissionGuard.canActivate(routeDeclaring([PermissionsEnum.ALL_ORG_VIEW]))).resolves.toBe(false);
		// TenantPermissionGuard always asks the role query: it is never asked about a permission outside the list.
		await expect(tenantPermissionGuard.canActivate(routeDeclaring([PermissionsEnum.ALL_ORG_VIEW]))).resolves.toBe(
			false
		);
		await tenantPermissionGuard.canActivate(routeDeclaring(TIMER_STATUS));
		for (const [, , asked] of rolePermissionService.checkRolePermission.mock.calls as unknown[][]) {
			expect(EMBED_TOKEN_PERMISSIONS).toEqual(expect.arrayContaining(asked as PermissionsEnum[]));
		}
	});

	it('keeps the role query PermissionGuard falls back to from granting a permission outside the list', async () => {
		// A role the attached state cannot tie to the request's tenant: the role query decides, and grants anything.
		const { strategy } = strategyFor(RolesEnum.ADMIN, ADMIN_PERMISSIONS, { roleTenantId: OTHER_TENANT });
		const { permissionGuard, rolePermissionService } = guards();
		actAs(await strategy.validate(embedPayload));

		await expect(permissionGuard.canActivate(routeDeclaring([PermissionsEnum.ALL_ORG_VIEW]))).resolves.toBe(false);
		await expect(permissionGuard.canActivate(routeDeclaring(TIMER_STATUS))).resolves.toBe(true);

		expect(rolePermissionService.checkRolePermission).toHaveBeenCalledTimes(1);
		expect(rolePermissionService.checkRolePermission).toHaveBeenCalledWith(
			TENANT,
			ROLE_ID,
			[PermissionsEnum.TIME_TRACKER],
			true
		);
	});

	it('makes RequestContext refuse CHANGE_SELECTED_EMPLOYEE, so the token reads its own member only', async () => {
		const { strategy } = strategyFor(RolesEnum.ADMIN, ADMIN_PERMISSIONS);
		actAs(await strategy.validate(embedPayload));

		expect(RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)).toBe(false);
		expect(RequestContext.hasPermission(PermissionsEnum.ALL_ORG_VIEW)).toBe(false);
		expect(
			RequestContext.hasAnyPermission([
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
				PermissionsEnum.ORG_MEMBER_LAST_LOG_VIEW
			])
		).toBe(false);
		expect(RequestContext.hasPermission(PermissionsEnum.TIME_TRACKER)).toBe(true);
		expect(RequestContext.currentEmployeeId()).toBe(EMPLOYEE);
	});

	it('leaves a token of the same administrator without the embed claims every permission', async () => {
		// Both tokens name the same user, employee, organization and tenant: they share one validated context.
		const cache = new AuthenticatedUserCache({ ttlMs: 10_000, ormType: 'typeorm' });
		const { strategy, authService } = strategyFor(RolesEnum.ADMIN, ADMIN_PERMISSIONS, { cache });
		const { permissionGuard } = guards();

		const embedUser = await strategy.validate(embedPayload);
		const sessionUser = await strategy.validate(firstPartyPayload);
		const embedUserAgain = await strategy.validate(embedPayload);

		expect(authService.getAuthenticatedUser).toHaveBeenCalledTimes(1);
		expect(sessionUser.permissions).toEqual(ADMIN_PERMISSIONS);
		expect(sorted(embedUser.permissions)).toEqual(sorted(EMBED_TOKEN_PERMISSIONS));
		expect(sorted(embedUserAgain.permissions)).toEqual(sorted(EMBED_TOKEN_PERMISSIONS));

		actAs(sessionUser);
		expect(RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)).toBe(true);
		expect(RequestContext.currentEmployeeId()).toBeNull();
		await expect(permissionGuard.canActivate(routeDeclaring([PermissionsEnum.ALL_ORG_VIEW]))).resolves.toBe(true);
	});

	it("never gives a super admin's or an admin's embed token their role exemptions", async () => {
		const superAdmin = strategyFor(RolesEnum.SUPER_ADMIN, defaultPermissionsOf(RolesEnum.SUPER_ADMIN)).strategy;
		const { tenantPermissionGuard } = guards();

		actAs(await superAdmin.validate(embedPayload));
		expect(RequestContext.hasRoles([RolesEnum.SUPER_ADMIN])).toBe(false);
		// TenantPermissionGuard's SUPER_ADMIN shortcut would have let this through before the embed narrowing.
		await expect(tenantPermissionGuard.canActivate(routeDeclaring([PermissionsEnum.ALL_ORG_VIEW]))).resolves.toBe(
			false
		);

		actAs(await strategyFor(RolesEnum.ADMIN, ADMIN_PERMISSIONS).strategy.validate(embedPayload));
		expect(RequestContext.hasRoles([RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN])).toBe(false);
		// A tenant admin reaches every organization; the embed token stays in its own.
		expect(currentOrganizationBoundary()).toEqual({ organizationId: ORG });

		// CONTROL: the same super admin without the embed claims keeps the shortcut.
		actAs(await superAdmin.validate(firstPartyPayload));
		expect(RequestContext.hasRoles([RolesEnum.SUPER_ADMIN])).toBe(true);
		await expect(tenantPermissionGuard.canActivate(routeDeclaring([PermissionsEnum.ALL_ORG_VIEW]))).resolves.toBe(
			true
		);
	});

	it('never gives an embed token a permission its role does not hold', async () => {
		// A role given the timer and the whole organization's view, but not the teams.
		const permissions = [PermissionsEnum.TIME_TRACKER, PermissionsEnum.ALL_ORG_VIEW];
		const { strategy } = strategyFor(RolesEnum.EMPLOYEE, permissions);
		const { permissionGuard } = guards();
		const user = await strategy.validate(embedPayload);
		actAs(user);

		expect(user.permissions).toEqual([PermissionsEnum.TIME_TRACKER]);
		expect(RequestContext.hasPermission(PermissionsEnum.ORG_TEAM_VIEW)).toBe(false);
		await expect(permissionGuard.canActivate(routeDeclaring(MY_TEAMS))).resolves.toBe(false);
	});
});
