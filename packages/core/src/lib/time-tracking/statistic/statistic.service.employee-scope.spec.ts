import '../../core/entities/internal';

import { ID, IGetCountsStatistics, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { ManagedEmployeeService, NO_ACCESSIBLE_EMPLOYEE_ID } from '../../employee/managed-employee.service';
import { StatisticService } from './statistic.service';

const TENANT_ID = '9d347c5c-5b96-4ef3-9799-b5fa0ca09111';
const USER_ID = '2f4b6d8a-0c1e-4a3b-8d5f-6e7a8b9c0d1e';
const OWN_EMPLOYEE_ID = '619ec3c7-498d-4c28-8b74-48da57cc5564';
const OTHER_EMPLOYEE_ID = '12128029-8b07-45a0-9690-181a66a660fc';

/**
 * The employee and project counts apply their employee predicate only when the id list is non-empty, and take
 * that list from getCounts. A token with no employee identity must reach them as an id that matches nothing:
 * no predicate at all would answer with the whole organization. See
 * `managed-employee.service.no-employee-identity.spec.ts` for the shared helper getCounts scopes through.
 */
class TestStatisticService extends StatisticService {
	/** Runs getCounts with its queries stubbed and returns the employee ids the two counts were given. */
	async restrict(employeeIds: ID[] = []): Promise<ID[]> {
		const noActivity = { overall: 0, duration: 0 };
		const employeeCounts = jest.spyOn(this as any, 'getEmployeeWorkedCounts').mockResolvedValue(0);
		const projectCounts = jest.spyOn(this as any, 'getProjectWorkedCounts').mockResolvedValue(0);
		jest.spyOn(this as StatisticService, 'getWeeklyStatisticsActivities').mockResolvedValue(noActivity);
		jest.spyOn(this as StatisticService, 'getTodayStatisticsActivities').mockResolvedValue(noActivity);

		await this.getCounts({ employeeIds } as IGetCountsStatistics);

		const [employeeScope, projectScope] = [employeeCounts, projectCounts].map(
			(count) => (count.mock.lastCall[0] as IGetCountsStatistics).employeeIds
		);
		expect(projectScope).toEqual(employeeScope);
		return employeeScope;
	}
}

describe('StatisticService employee scoping', () => {
	let service: TestStatisticService;

	const actAs = (caller: { user: unknown; permissions?: PermissionsEnum[] }) => {
		const granted = caller.permissions ?? [];
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(caller.user as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) => granted.includes(permission));
	};

	beforeEach(() => {
		service = new TestStatisticService(
			{ createQueryBuilder: jest.fn() } as any,
			{ existsBy: jest.fn() } as any,
			{ createQueryBuilder: jest.fn() } as any,
			{ createQueryBuilder: jest.fn() } as any,
			{ getKnex: jest.fn() } as any,
			{} as any,
			{} as any,
			new ManagedEmployeeService({} as any, {} as any)
		);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('pins an authenticated caller with no employee identity to an id that matches nothing', async () => {
		actAs({ user: { id: USER_ID, tenantId: TENANT_ID } });

		await expect(service.restrict([OTHER_EMPLOYEE_ID])).resolves.toEqual([NO_ACCESSIBLE_EMPLOYEE_ID]);
		await expect(service.restrict()).resolves.toEqual([NO_ACCESSIBLE_EMPLOYEE_ID]);
	});

	it('keeps the requested ids for an organization-wide viewer', async () => {
		actAs({ user: { id: USER_ID, tenantId: TENANT_ID }, permissions: [PermissionsEnum.ALL_ORG_VIEW] });

		await expect(service.restrict([OTHER_EMPLOYEE_ID])).resolves.toEqual([OTHER_EMPLOYEE_ID]);
	});

	it('leaves a request with no user at all alone (public share links, internal calls)', async () => {
		actAs({ user: null });

		await expect(service.restrict([OTHER_EMPLOYEE_ID])).resolves.toEqual([OTHER_EMPLOYEE_ID]);
	});

	it('pins a normal employee to their own id', async () => {
		actAs({ user: { id: USER_ID, tenantId: TENANT_ID, employeeId: OWN_EMPLOYEE_ID } });

		await expect(service.restrict([OTHER_EMPLOYEE_ID])).resolves.toEqual([OWN_EMPLOYEE_ID]);
	});

	it('lets a CHANGE_SELECTED_EMPLOYEE holder ask for anyone', async () => {
		actAs({
			user: { id: USER_ID, tenantId: TENANT_ID, employeeId: OWN_EMPLOYEE_ID },
			permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]
		});

		await expect(service.restrict([OTHER_EMPLOYEE_ID])).resolves.toEqual([OTHER_EMPLOYEE_ID]);
	});
});
