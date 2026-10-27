/**
 * Load the entity graph FIRST, as the application does (see employee.resolver.spec.ts): importing the
 * controller through the validators otherwise leaves an entity decorator undefined.
 */
import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { NO_ACCESSIBLE_EMPLOYEE_ID } from './managed-employee.service';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const MY_TEAM = '00000000-0000-4000-8000-0000000000c1';
const CALLER = 'caller-employee';
const COLLEAGUES = [CALLER, 'team-mate', 'project-mate'];

/**
 * `GET /employee/members` refused an employee who named no team, which emptied every member list of the
 * Plane UI (pm.gauzy.co) for non-admins. Naming neither now lists the caller's colleagues.
 */
describe('EmployeeController.getMembers — scoped to the people the caller works with', () => {
	let findMembers: jest.Mock;
	let scopeMembersRead: jest.Mock;
	let controller: EmployeeController;

	beforeEach(() => {
		findMembers = jest.fn().mockResolvedValue({ items: [], total: 0 });
		scopeMembersRead = jest.fn(async (employeeId?: string, teamId?: string) => {
			if (!employeeId) return { allowed: false };
			if (teamId) return teamId === MY_TEAM ? { allowed: true } : { allowed: false };
			return { allowed: true, employeeIds: COLLEAGUES };
		});
		controller = new EmployeeController({ findMembers } as any, {} as any, { scopeMembersRead } as any, {} as any);
		jest.spyOn(RequestContext, 'hasAnyPermission').mockReturnValue(false);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(CALLER);
	});

	afterEach(() => jest.restoreAllMocks());

	it("lists an employee's colleagues when the read names no team", async () => {
		await controller.getMembers({ organizationId: ORGANIZATION } as any);

		expect(scopeMembersRead).toHaveBeenCalledWith(CALLER, undefined, undefined);
		expect(findMembers).toHaveBeenCalledWith({ organizationId: ORGANIZATION }, COLLEAGUES);
	});

	it('lists a named team of the caller without narrowing it further', async () => {
		await controller.getMembers({ organizationId: ORGANIZATION, organizationTeamId: MY_TEAM } as any);

		expect(findMembers).toHaveBeenCalledWith(
			{ organizationId: ORGANIZATION, organizationTeamId: MY_TEAM },
			undefined
		);
	});

	it('refuses a team the caller is not in, and a caller without an employee record, before reading', async () => {
		await expect(
			controller.getMembers({ organizationId: ORGANIZATION, organizationTeamId: 'another-team' } as any)
		).rejects.toBeInstanceOf(ForbiddenException);

		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(undefined);
		await expect(controller.getMembers({ organizationId: ORGANIZATION } as any)).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(findMembers).not.toHaveBeenCalled();
	});

	it('lists the whole organization to an organization-wide viewer, without scoping (control)', async () => {
		jest.spyOn(RequestContext, 'hasAnyPermission').mockReturnValue(true);

		await controller.getMembers({ organizationId: ORGANIZATION } as any);

		expect(scopeMembersRead).not.toHaveBeenCalled();
		expect(findMembers).toHaveBeenCalledWith({ organizationId: ORGANIZATION });
	});
});

describe('EmployeeService.findMembers — narrowed to the given employees', () => {
	/** A query builder that records its where clauses, running Brackets against itself. */
	function recordingQuery() {
		const wheres: Array<[string, Record<string, unknown> | undefined]> = [];
		const query: any = {
			alias: 'employee',
			leftJoin: jest.fn(() => query),
			setFindOptions: jest.fn(() => query),
			andWhere: jest.fn((where: any, parameters?: Record<string, unknown>) => {
				if (typeof where === 'string') {
					wheres.push([where, parameters]);
				} else {
					where.whereFactory(query);
				}
				return query;
			}),
			getManyAndCount: jest.fn(async () => [[], 0])
		};
		return { query, wheres };
	}

	let service: EmployeeService;
	let recorded: ReturnType<typeof recordingQuery>;

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant');
		recorded = recordingQuery();
		service = new EmployeeService({ createQueryBuilder: () => recorded.query } as any, {} as any);
	});

	afterEach(() => jest.restoreAllMocks());

	const idFilter = () => recorded.wheres.filter(([where]) => where.includes('IN (:...employeeIds)'));

	it('adds an id filter for the given employees', async () => {
		await service.findMembers({ organizationId: ORGANIZATION } as any, COLLEAGUES);

		expect(idFilter()).toEqual([['"employee"."id" IN (:...employeeIds)', { employeeIds: COLLEAGUES }]]);
	});

	it('matches no one for an empty list, never reading it as "no filter"', async () => {
		await service.findMembers({ organizationId: ORGANIZATION } as any, []);

		expect(idFilter()).toEqual([
			['"employee"."id" IN (:...employeeIds)', { employeeIds: [NO_ACCESSIBLE_EMPLOYEE_ID] }]
		]);
	});

	it('adds no id filter when none is given (control)', async () => {
		await service.findMembers({ organizationId: ORGANIZATION } as any);

		expect(idFilter()).toEqual([]);
		expect(recorded.wheres.map(([where]) => where)).toContain('"employee"."organizationId" = :organizationId');
	});
});
