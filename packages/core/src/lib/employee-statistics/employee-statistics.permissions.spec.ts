/**
 * Load the entity graph FIRST, as the application does: the controller reaches EmployeeService, whose
 * import through the validators otherwise leaves an entity decorator undefined.
 */
import '../core/entities/internal';

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { ID, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { DEFAULT_ROLE_PERMISSIONS } from '../role-permission/default-role-permissions';
import { PermissionGuard } from '../shared/guards/permission.guard';
import { EmployeeStatisticsController } from './employee-statistics.controller';
import { EmployeeStatisticsResolver } from './employee-statistics.resolver';

/**
 * GHSA-v79w-54p2-wmh5 backlog, owner decision 2 (2026-10-22): the four `/employee-statistics` reads stated no
 * permission, and `PermissionGuard` answers `true` to a route that states none, so every signed-in member of the
 * tenant — VIEWER and CANDIDATE included — could read what employees earned, spent and brought in as profit.
 *
 * Each route now states the pair of the dashboard tab that shows its figures, behind `PermissionGuard`: the
 * organization aggregate the Accounting tab's, one employee's figures the Human Resources tab's. This suite reads
 * the metadata Nest reads and runs the real guard over it, for the roles' default grants.
 */

const TENANT_ID = 'a0000000-0000-4000-8000-000000000001';
const ROLE_ID = 'b0000000-0000-4000-8000-000000000001';

const ACCOUNTING = [PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.ACCOUNTING_DASHBOARD];
const HUMAN_RESOURCES = [PermissionsEnum.ADMIN_DASHBOARD_VIEW, PermissionsEnum.HUMAN_RESOURCE_DASHBOARD];

/** Every route, the GraphQL field that mirrors it, and the pair it reads under. */
const ROUTES: ReadonlyArray<{ route: string; field: string; expected: PermissionsEnum[] }> = [
	{ route: 'findAggregatedByOrganizationId', field: 'employeeStatisticsAggregate', expected: ACCOUNTING },
	{ route: 'findAllByEmployeeId', field: 'employeeStatisticsSeries', expected: HUMAN_RESOURCES },
	{ route: 'findAggregatedStatisticsByEmployeeId', field: 'employeeMonthlyStatistics', expected: HUMAN_RESOURCES },
	{ route: 'findEmployeeStatisticsHistory', field: 'employeeStatisticsHistory', expected: HUMAN_RESOURCES }
];

function handler(target: Function, name: string): Function {
	return (target.prototype as Record<string, Function>)[name];
}

/** The guards a route runs under: the class chain, then the handler's own. */
function guardsOf(target: Function, name: string): unknown[] {
	return [
		...(Reflect.getMetadata('__guards__', target) ?? []),
		...(Reflect.getMetadata('__guards__', handler(target, name)) ?? [])
	];
}

/** The permissions a route runs under, by the rule `PermissionGuard` applies: the handler's, else the class's. */
function permissionsOf(target: Function, name: string): unknown {
	return new Reflector().getAllAndOverride(PERMISSIONS_METADATA, [handler(target, name), target]);
}

/** The real guard, deciding from the role grants `JwtStrategy` attaches to the request's user. */
function decide(target: Function, name: string, granted: readonly PermissionsEnum[]): Promise<boolean> {
	const user = {
		id: 'user-1',
		tenantId: TENANT_ID,
		roleId: ROLE_ID,
		role: { id: ROLE_ID, name: RolesEnum.EMPLOYEE, tenantId: TENANT_ID },
		permissions: [...granted]
	};
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue(user as any);
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID as ID);
	jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue(ROLE_ID as ID);
	jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1' as ID);
	jest.spyOn(RequestContext, 'currentRoleName').mockReturnValue(RolesEnum.EMPLOYEE);

	// The attached grants decide; the role-permission query must not be needed.
	const rolePermissionService = { checkRolePermission: jest.fn(async () => true) };
	const guard = new PermissionGuard(
		{ get: jest.fn(), set: jest.fn() } as any,
		new Reflector(),
		rolePermissionService as any
	);
	const context = {
		getType: () => 'http',
		getHandler: () => handler(target, name),
		getClass: () => target,
		switchToHttp: () => ({ getRequest: () => ({ headers: {} }) })
	} as unknown as ExecutionContext;

	return guard
		.canActivate(context)
		.finally(() => expect(rolePermissionService.checkRolePermission).not.toHaveBeenCalled());
}

/** A role's default grants, as a new tenant is provisioned with them. */
function defaultsOf(role: RolesEnum): PermissionsEnum[] {
	return DEFAULT_ROLE_PERMISSIONS.find((entry) => entry.role === role)?.defaultEnabledPermissions ?? [];
}

beforeEach(() => {
	jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('employee statistics — every read states its dashboard pair behind PermissionGuard', () => {
	it.each(ROUTES)('$route states its pair, and so does $field', ({ route, field, expected }) => {
		expect(guardsOf(EmployeeStatisticsController, route)).toContain(PermissionGuard);
		expect(permissionsOf(EmployeeStatisticsController, route)).toEqual(expected);

		expect(guardsOf(EmployeeStatisticsResolver, field)).toContain(PermissionGuard);
		expect(permissionsOf(EmployeeStatisticsResolver, field)).toEqual(expected);
	});

	it.each(ROUTES)('refuses $route to a role that holds neither grant of its pair', async ({ route }) => {
		await expect(decide(EmployeeStatisticsController, route, [PermissionsEnum.ORG_EMPLOYEES_VIEW])).resolves.toBe(
			false
		);
	});

	it('serves the aggregate to the Accounting grant and not to the Human Resources one, and the reverse for an employee’s figures', async () => {
		for (const { route, expected } of ROUTES) {
			const aggregate = expected === ACCOUNTING;

			await expect(
				decide(EmployeeStatisticsController, route, [PermissionsEnum.ACCOUNTING_DASHBOARD])
			).resolves.toBe(aggregate);
			await expect(
				decide(EmployeeStatisticsController, route, [PermissionsEnum.HUMAN_RESOURCE_DASHBOARD])
			).resolves.toBe(!aggregate);
			await expect(
				decide(EmployeeStatisticsController, route, [PermissionsEnum.ADMIN_DASHBOARD_VIEW])
			).resolves.toBe(true);
		}
	});

	it('keeps every read open to the default administrators and employees, so an employee still reads their own figures', async () => {
		for (const role of [RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN, RolesEnum.EMPLOYEE]) {
			for (const { route } of ROUTES) {
				await expect(decide(EmployeeStatisticsController, route, defaultsOf(role))).resolves.toBe(true);
			}
		}
	});

	it('closes every read to the default roles the dashboard tabs are not shown to', async () => {
		for (const role of [
			RolesEnum.VIEWER,
			RolesEnum.CANDIDATE,
			RolesEnum.INTERVIEWER,
			RolesEnum.DATA_ENTRY,
			RolesEnum.MANAGER
		]) {
			for (const { route } of ROUTES) {
				await expect(decide(EmployeeStatisticsController, route, defaultsOf(role))).resolves.toBe(false);
			}
		}
	});
});
