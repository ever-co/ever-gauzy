import '../../core/entities/internal';

import { DatabaseTypeEnum } from '@gauzy/config';
import { ID, IGetTasksStatistics, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { StatisticService } from './statistic.service';

const TENANT_ID = '9d347c5c-5b96-4ef3-9799-b5fa0ca09111';
const ORGANIZATION_ID = '5e0f3c2a-8b1d-4a6e-9c7f-1d2e3f4a5b6c';
const USER_ID = '2f4b6d8a-0c1e-4a3b-8d5f-6e7a8b9c0d1e';
const OWN_EMPLOYEE_ID = '619ec3c7-498d-4c28-8b74-48da57cc5564';
const OTHER_EMPLOYEE_ID = '12128029-8b07-45a0-9690-181a66a660fc';
const TEAM_A_ID = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const TEAM_B_ID = '8b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d5e';

/** No employee predicate: the task reads then return the time of every member of the named teams. */
const EVERY_MEMBER: ID[] = [];

/** The part of the filters of a task duration read these cases check. */
type DurationReadFilters = { employeeIds: ID[] };

/** The total duration query of getTasks: every builder call returns the query, and the total is zero. */
const createTotalDurationQuery = () => ({
	alias: 'time_log',
	select: jest.fn().mockReturnThis(),
	innerJoin: jest.fn().mockReturnThis(),
	andWhere: jest.fn().mockReturnThis(),
	getQuery: jest.fn().mockReturnValue(''),
	getRawOne: jest.fn().mockResolvedValue({ duration: 0 })
});

/** A StatisticService on TypeORM, reading time logs and team memberships from the repositories given. */
class TasksTeamScopeStatisticService extends StatisticService {
	constructor(timeLogRepository: unknown, managedEmployeeService: ManagedEmployeeService) {
		super(
			{} as any,
			{} as any,
			{} as any,
			timeLogRepository as any,
			{} as any,
			{} as any,
			{ dbConnectionOptions: { type: DatabaseTypeEnum.postgres } } as any,
			managedEmployeeService
		);
		this.ormType = MultiORMEnum.TypeORM;
	}
}

/**
 * #11451: timeTrackingTasks with an organizationTeamId and no employeeIds kept the employee list empty, which reads
 * the time of every member of the named teams, whoever the caller was. It now does so only for a caller who belongs
 * to organizationTeamId and to every team of teamIds, or who holds ALL_ORG_VIEW or ORG_MEMBER_LAST_LOG_VIEW. Anyone
 * else goes through the usual employee filter, as on the REST route. The resolver specs mock getTasks, so these
 * cases drive it with its reads stubbed and check the employee ids each read is given.
 */
describe('StatisticService.getTasks team scope', () => {
	let teamMemberships: { existsBy: jest.Mock; find: jest.Mock };
	let totalDurationQuery: ReturnType<typeof createTotalDurationQuery>;
	let service: TasksTeamScopeStatisticService;

	/** Signs in as an employee holding the given permissions and belonging to the given teams. */
	const actAs = (caller: { permissions?: PermissionsEnum[]; memberOf?: ID[] }) => {
		const granted = caller.permissions ?? [];
		const memberOf = caller.memberOf ?? [];
		const user = { id: USER_ID, tenantId: TENANT_ID, employeeId: OWN_EMPLOYEE_ID };

		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(user as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) => granted.includes(permission));
		teamMemberships.existsBy.mockImplementation(async (where: { employeeId: ID; organizationTeamId: ID }) => {
			const isCaller = where.employeeId === OWN_EMPLOYEE_ID;
			const isInTeam = memberOf.includes(where.organizationTeamId);
			return isCaller && isInTeam;
		});
	};

	/** The employee ids the total duration query filtered on, every member when it applied no employee predicate. */
	const totalDurationScope = (): ID[] => {
		const whereCalls = totalDurationQuery.andWhere.mock.calls;
		const employeeCondition = whereCalls.find(([, parameters]) => parameters?.employeeIds);
		if (!employeeCondition) {
			return EVERY_MEMBER;
		}
		return employeeCondition[1].employeeIds;
	};

	/** Runs getTasks with its reads stubbed and returns the employee ids its three duration reads were given. */
	const readScope = async (request: Partial<IGetTasksStatistics>): Promise<ID[]> => {
		const durationRows = jest.spyOn(service as any, 'getTaskDurationRows').mockResolvedValue([]);

		await service.getTasks({ organizationId: ORGANIZATION_ID, ...request } as IGetTasksStatistics);

		const [todayScope, periodScope] = durationRows.mock.calls.map(
			([filters]) => (filters as DurationReadFilters).employeeIds
		);
		expect(periodScope).toEqual(todayScope);
		expect(totalDurationScope()).toEqual(todayScope);
		return todayScope;
	};

	beforeEach(() => {
		teamMemberships = { existsBy: jest.fn(), find: jest.fn().mockResolvedValue([]) };
		totalDurationQuery = createTotalDurationQuery();
		const timeLogRepository = { createQueryBuilder: () => totalDurationQuery };
		const managedEmployeeService = new ManagedEmployeeService(teamMemberships as any, { find: jest.fn() } as any);
		service = new TasksTeamScopeStatisticService(timeLogRepository, managedEmployeeService);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('reads only their own time for a caller outside the named team', async () => {
		actAs({ memberOf: [TEAM_A_ID] });

		await expect(readScope({ organizationTeamId: TEAM_B_ID })).resolves.toEqual([OWN_EMPLOYEE_ID]);
	});

	it('reads the whole team for a member of the named team and of every team of teamIds', async () => {
		actAs({ memberOf: [TEAM_A_ID, TEAM_B_ID] });

		const request = { organizationTeamId: TEAM_A_ID, teamIds: [TEAM_B_ID] };
		await expect(readScope(request)).resolves.toEqual(EVERY_MEMBER);
	});

	it('reads only their own time for a member of the named team who is outside another team of teamIds', async () => {
		actAs({ memberOf: [TEAM_A_ID] });

		const request = { organizationTeamId: TEAM_A_ID, teamIds: [TEAM_B_ID] };
		await expect(readScope(request)).resolves.toEqual([OWN_EMPLOYEE_ID]);
	});

	it('reads the whole team for a member who sends teamIds: null, as a GraphQL client can', async () => {
		actAs({ memberOf: [TEAM_A_ID] });

		await expect(readScope({ organizationTeamId: TEAM_A_ID, teamIds: null })).resolves.toEqual(EVERY_MEMBER);
	});

	it('reads the whole team for an ALL_ORG_VIEW holder outside it, without a membership lookup', async () => {
		actAs({ permissions: [PermissionsEnum.ALL_ORG_VIEW] });

		await expect(readScope({ organizationTeamId: TEAM_B_ID })).resolves.toEqual(EVERY_MEMBER);
		expect(teamMemberships.existsBy).not.toHaveBeenCalled();
	});

	it('keeps every member for an ORG_MEMBER_LAST_LOG_VIEW holder outside the named team, as before', async () => {
		actAs({ permissions: [PermissionsEnum.ORG_MEMBER_LAST_LOG_VIEW] });

		await expect(readScope({ organizationTeamId: TEAM_B_ID })).resolves.toEqual(EVERY_MEMBER);
		expect(teamMemberships.existsBy).not.toHaveBeenCalled();
	});

	it('keeps every member for an ORG_MEMBER_LAST_LOG_VIEW holder who names no team, as on the REST route', async () => {
		actAs({ permissions: [PermissionsEnum.ORG_MEMBER_LAST_LOG_VIEW] });

		await expect(readScope({})).resolves.toEqual(EVERY_MEMBER);
	});

	it('leaves a CHANGE_SELECTED_EMPLOYEE holder outside the named team to the usual filter, as before', async () => {
		actAs({ permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE] });

		await expect(readScope({ organizationTeamId: TEAM_B_ID })).resolves.toEqual(EVERY_MEMBER);
		expect(teamMemberships.existsBy).not.toHaveBeenCalled();
	});

	it('applies the usual filter to explicit employeeIds, even from a member of the named team', async () => {
		actAs({ memberOf: [TEAM_A_ID] });

		const request = { organizationTeamId: TEAM_A_ID, employeeIds: [OTHER_EMPLOYEE_ID] };
		await expect(readScope(request)).resolves.toEqual([OWN_EMPLOYEE_ID]);
	});

	it('reads only their own time with onlyMe, even for a member of the named team', async () => {
		actAs({ memberOf: [TEAM_A_ID] });

		await expect(readScope({ organizationTeamId: TEAM_A_ID, onlyMe: true })).resolves.toEqual([OWN_EMPLOYEE_ID]);
	});

	it('reads only their own time when no team is named, as on the REST route', async () => {
		actAs({ memberOf: [TEAM_A_ID] });

		await expect(readScope({})).resolves.toEqual([OWN_EMPLOYEE_ID]);
	});
});
