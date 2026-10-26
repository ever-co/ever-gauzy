import '../../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { DailyPlanService } from './daily-plan.service';

const TENANT_ID = '2a5d5f2e-0c4e-4f2b-9a0b-3d6a4b2f1c11';
const ORGANIZATION_ID = '8b1f0e3a-7c2d-4a5e-b6f7-1d2e3f4a5b6c';
const TEAM_ID = '5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9';
const EMPLOYEE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

/**
 * GET /daily-plan/team: a caller without CHANGE_SELECTED_EMPLOYEE must name a team they belong to. A denied
 * read must never reach the plan query; the fake repository throws when it is reached.
 */
describe('DailyPlanService.getTeamDailyPlans — team membership', () => {
	let service: DailyPlanService;
	let createQueryBuilder: jest.Mock;
	let managedEmployeeService: { isMemberOfTeam: jest.Mock };
	let granted: PermissionsEnum[];
	let employeeId: string | null;

	beforeEach(() => {
		granted = [];
		employeeId = EMPLOYEE_ID;
		createQueryBuilder = jest.fn(() => {
			throw new Error('reached the plan query');
		});
		managedEmployeeService = { isMemberOfTeam: jest.fn(async () => true) };
		service = new DailyPlanService(
			{ metadata: { tableName: 'daily_plan' }, createQueryBuilder } as any,
			{} as any,
			{} as any,
			{} as any,
			managedEmployeeService as any
		);
		Object.defineProperty(service, 'ormType', { value: MultiORMEnum.TypeORM });

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockImplementation(() => employeeId);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: PermissionsEnum) =>
			granted.includes(permission)
		);
	});

	afterEach(() => jest.restoreAllMocks());

	const read = (where: Record<string, unknown> = {}) =>
		service.getTeamDailyPlans({ where: { organizationId: ORGANIZATION_ID, ...where } } as any);

	it('lets a member read their own team', async () => {
		await expect(read({ organizationTeamId: TEAM_ID })).rejects.toThrow(/reached the plan query/);
		expect(managedEmployeeService.isMemberOfTeam).toHaveBeenCalledWith(EMPLOYEE_ID, TEAM_ID);
	});

	it('refuses a team the caller does not belong to, before any query', async () => {
		managedEmployeeService.isMemberOfTeam.mockResolvedValue(false);

		await expect(read({ organizationTeamId: TEAM_ID })).rejects.toBeInstanceOf(ForbiddenException);
		expect(createQueryBuilder).not.toHaveBeenCalled();
	});

	it.each([
		['no team', undefined],
		['a repeated query value', [TEAM_ID, TEAM_ID]],
		['a malformed id', 'not-a-uuid']
	])('refuses %s without the membership lookup', async (_label, organizationTeamId) => {
		await expect(read({ organizationTeamId })).rejects.toBeInstanceOf(ForbiddenException);
		expect(managedEmployeeService.isMemberOfTeam).not.toHaveBeenCalled();
		expect(createQueryBuilder).not.toHaveBeenCalled();
	});

	it('keeps the whole organization for a CHANGE_SELECTED_EMPLOYEE holder', async () => {
		granted = [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE];
		employeeId = null;

		await expect(read()).rejects.toThrow(/reached the plan query/);
		expect(managedEmployeeService.isMemberOfTeam).not.toHaveBeenCalled();
	});

	it('keeps the whole organization for an ALL_ORG_VIEW holder without an employee record', async () => {
		granted = [PermissionsEnum.ALL_ORG_VIEW];
		employeeId = null;

		await expect(read()).rejects.toThrow(/reached the plan query/);
		expect(managedEmployeeService.isMemberOfTeam).not.toHaveBeenCalled();
	});
});

describe('ManagedEmployeeService.isMemberOfTeam', () => {
	afterEach(() => jest.restoreAllMocks());

	it('fails closed without a tenant, an employee or a team, and never queries', async () => {
		const existsBy = jest.fn(async () => true);
		const service = new ManagedEmployeeService({ existsBy } as any, {} as any);
		const tenant = jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);

		await expect(service.isMemberOfTeam(undefined as any, TEAM_ID)).resolves.toBe(false);
		await expect(service.isMemberOfTeam(EMPLOYEE_ID, undefined as any)).resolves.toBe(false);
		tenant.mockReturnValue(null);
		await expect(service.isMemberOfTeam(EMPLOYEE_ID, TEAM_ID)).resolves.toBe(false);

		expect(existsBy).not.toHaveBeenCalled();
	});
});
