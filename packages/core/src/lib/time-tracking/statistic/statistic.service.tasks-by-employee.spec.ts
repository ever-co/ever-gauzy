import '../../core/entities/internal';

import { DatabaseTypeEnum } from '@gauzy/config';
import { ID, ITasksStatistics, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { StatisticService } from './statistic.service';

const TENANT_ID = '9d347c5c-5b96-4ef3-9799-b5fa0ca09111';
const ORGANIZATION_ID = '5e0f3c2a-8b1d-4a6e-9c7f-1d2e3f4a5b6c';
const USER_ID = '2f4b6d8a-0c1e-4a3b-8d5f-6e7a8b9c0d1e';
const TEAM_ID = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const CALLER_ID = '619ec3c7-498d-4c28-8b74-48da57cc5564';
const FIRST_TEAMMATE_ID = '12128029-8b07-45a0-9690-181a66a660fc';
const SECOND_TEAMMATE_ID = '3c5e7a9b-1d2f-4a6c-8e0b-2d4f6a8c0e1a';
const TEAM_MEMBER_IDS: ID[] = [CALLER_ID, FIRST_TEAMMATE_ID, SECOND_TEAMMATE_ID];

/** A time log of the team, as a task duration read returns it with the employee of each log. */
type LoggedTime = { employeeId: ID; taskId: ID; seconds: number };

const CALLER_TIME: LoggedTime = { employeeId: CALLER_ID, taskId: 'caller-task', seconds: 98 };
const FIRST_TEAMMATE_TIME: LoggedTime = { employeeId: FIRST_TEAMMATE_ID, taskId: 'first-task', seconds: 1200 };
const SECOND_TEAMMATE_TIME: LoggedTime = { employeeId: SECOND_TEAMMATE_ID, taskId: 'second-task', seconds: 300 };

/** The part of the filters of a task duration read these cases look at. */
type DurationReadFilters = { employeeIds: ID[]; byEmployee?: boolean };

/** A StatisticService on TypeORM whose team memberships come from the repository given. */
class TasksByEmployeeStatisticService extends StatisticService {
	constructor(managedEmployeeService: ManagedEmployeeService) {
		super(
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{ dbConnectionOptions: { type: DatabaseTypeEnum.postgres } } as any,
			managedEmployeeService
		);
		this.ormType = MultiORMEnum.TypeORM;
	}
}

/** The task ids and durations of one member's entry. */
const durationsOf = (tasks: ITasksStatistics[]) => tasks.map(({ id, duration }) => ({ id, duration }));

/**
 * #12127: the team read (GET /organization-team/:id?withLastWorkedTask=true) fills every member's task time through
 * getTasksByEmployee. It gave each member the scope of a one-employee read, which for a caller who manages nothing is
 * the caller's own employee, so a plain member got her own time under every teammate's name. Each member's entry now
 * holds only that member's own time, and nothing for a member the caller may not read.
 */
describe('StatisticService.getTasksByEmployee member scope', () => {
	let teamMemberships: { existsBy: jest.Mock; find: jest.Mock };
	let durationReads: jest.SpyInstance;
	let service: TasksByEmployeeStatisticService;
	let loggedTimes: LoggedTime[];

	/** Signs in as the caller's employee, holding the given permissions, a member and a manager of the given teams. */
	const actAs = (caller: { permissions?: PermissionsEnum[]; memberOf?: ID[]; manages?: ID[]; employeeId?: ID }) => {
		const granted = caller.permissions ?? [];
		const memberOf = caller.memberOf ?? [];
		const manages = caller.manages ?? [];
		const employeeId = 'employeeId' in caller ? caller.employeeId : CALLER_ID;
		const user = { id: USER_ID, tenantId: TENANT_ID, employeeId };

		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(user as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) => granted.includes(permission));
		teamMemberships.existsBy.mockImplementation(async (where: { employeeId: ID; organizationTeamId: ID }) => {
			const isCaller = where.employeeId === CALLER_ID;
			const isInTeam = memberOf.includes(where.organizationTeamId);
			return isCaller && isInTeam;
		});
		teamMemberships.find.mockImplementation(async ({ where }: { where: { isManager?: boolean } }) => {
			if (where.isManager) {
				return manages.map((organizationTeamId) => ({ organizationTeamId }));
			}
			return TEAM_MEMBER_IDS.map((memberId) => ({ employeeId: memberId }));
		});
	};

	/** Reads the team's members the way the team read does, today's range included. */
	const readTeam = () =>
		service.getTasksByEmployee({
			organizationId: ORGANIZATION_ID,
			tenantId: TENANT_ID,
			organizationTeamId: TEAM_ID,
			employeeIds: TEAM_MEMBER_IDS,
			startDate: new Date('2026-11-21T00:00:00.000Z'),
			endDate: new Date('2026-11-21T23:59:59.999Z')
		});

	/** The employee ids the task duration reads were given. */
	const readEmployeeIds = (): ID[][] =>
		durationReads.mock.calls.map(([filters]) => (filters as DurationReadFilters).employeeIds);

	beforeEach(() => {
		loggedTimes = [];
		teamMemberships = { existsBy: jest.fn(), find: jest.fn() };
		const managedEmployeeService = new ManagedEmployeeService(teamMemberships as any, { find: jest.fn() } as any);
		service = new TasksByEmployeeStatisticService(managedEmployeeService);

		// Like the SQL read, a row only comes back for an employee the filter names, with the employee of its log.
		durationReads = jest
			.spyOn(service as any, 'getTaskDurationRows')
			.mockImplementation(async (filters: DurationReadFilters, durationAlias: string) =>
				loggedTimes
					.filter(({ employeeId }) => filters.employeeIds.includes(employeeId))
					.map(({ employeeId, taskId, seconds }) => ({
						title: taskId,
						taskId,
						updatedAt: '2026-11-21T09:00:00.000Z',
						employeeId,
						[durationAlias]: seconds
					}))
			);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("gives a plain member's teammates none of her time when only she tracked today", async () => {
		actAs({ memberOf: [TEAM_ID] });
		loggedTimes = [CALLER_TIME];

		const byEmployee = await readTeam();

		expect(byEmployee.get(FIRST_TEAMMATE_ID)).toEqual([]);
		expect(byEmployee.get(SECOND_TEAMMATE_ID)).toEqual([]);
		expect(durationsOf(byEmployee.get(CALLER_ID))).toEqual([{ id: 'caller-task', duration: 98 }]);
	});

	it('gives a plain member only her own time, and nothing under teammates who tracked their own', async () => {
		actAs({ memberOf: [TEAM_ID] });
		loggedTimes = [CALLER_TIME, FIRST_TEAMMATE_TIME, SECOND_TEAMMATE_TIME];

		const byEmployee = await readTeam();

		expect(durationsOf(byEmployee.get(CALLER_ID))).toEqual([{ id: 'caller-task', duration: 98 }]);
		expect(byEmployee.get(FIRST_TEAMMATE_ID)).toEqual([]);
		expect(byEmployee.get(SECOND_TEAMMATE_ID)).toEqual([]);
		expect(readEmployeeIds()).toEqual([[CALLER_ID], [CALLER_ID]]);
	});

	it("keeps each member's own time for the team's manager, as before", async () => {
		actAs({ memberOf: [TEAM_ID], manages: [TEAM_ID] });
		loggedTimes = [CALLER_TIME, FIRST_TEAMMATE_TIME, SECOND_TEAMMATE_TIME];

		const byEmployee = await readTeam();

		expect(durationsOf(byEmployee.get(CALLER_ID))).toEqual([{ id: 'caller-task', duration: 98 }]);
		expect(durationsOf(byEmployee.get(FIRST_TEAMMATE_ID))).toEqual([{ id: 'first-task', duration: 1200 }]);
		expect(durationsOf(byEmployee.get(SECOND_TEAMMATE_ID))).toEqual([{ id: 'second-task', duration: 300 }]);
	});

	it("keeps each member's own time for a CHANGE_SELECTED_EMPLOYEE holder outside the team, as before", async () => {
		actAs({ permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE] });
		loggedTimes = [FIRST_TEAMMATE_TIME, SECOND_TEAMMATE_TIME];

		const byEmployee = await readTeam();

		expect(byEmployee.get(CALLER_ID)).toEqual([]);
		expect(durationsOf(byEmployee.get(FIRST_TEAMMATE_ID))).toEqual([{ id: 'first-task', duration: 1200 }]);
		expect(durationsOf(byEmployee.get(SECOND_TEAMMATE_ID))).toEqual([{ id: 'second-task', duration: 300 }]);
		expect(teamMemberships.existsBy).not.toHaveBeenCalled();
	});

	it('gives nobody any time for a caller without an employee identity, as before', async () => {
		actAs({ memberOf: [TEAM_ID], employeeId: undefined });
		loggedTimes = [CALLER_TIME, FIRST_TEAMMATE_TIME, SECOND_TEAMMATE_TIME];

		const byEmployee = await readTeam();

		expect([...byEmployee.values()]).toEqual([[], [], []]);
	});

	it('counts a time slot only for the employee of its own time log', async () => {
		actAs({ memberOf: [TEAM_ID] });

		await readTeam();

		const byEmployeeFlags = durationReads.mock.calls.map(
			([filters]) => (filters as DurationReadFilters).byEmployee
		);
		expect(byEmployeeFlags).toEqual([true, true]);
	});
});
