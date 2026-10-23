import '../core/entities/internal';

import { In } from 'typeorm';
import { IUser, PermissionsEnum } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { EmployeeRecentVisitService } from './employee-recent-visit.service';

/**
 * A recent visit records what an employee opened, and when. The CRUD base limits a caller without
 * CHANGE_SELECTED_EMPLOYEE to their own employee, but a caller with no employee record at all (a viewer, a candidate)
 * kept the tenant-wide scope, and `findEmployeeRecentVisits` takes the employee from the query when the caller has
 * none: `GET /employee-recent-visit?employeeId=<anyone>` answered that employee's visits, and with no `employeeId`
 * every employee's.
 */
describe('EmployeeRecentVisitService — a caller with no employee record reads no one’s visits', () => {
	const VICTIM = 'victim-employee';

	let restore: () => void;
	let findAll: jest.SpyInstance;
	let service: EmployeeRecentVisitService;

	beforeEach(() => {
		findAll = jest.spyOn(CrudService.prototype, 'findAll').mockResolvedValue({ items: [], total: 0 } as never);
		service = new EmployeeRecentVisitService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'employee_recent_visit', hasColumnWithPropertyPath: () => true } } as any,
			{} as never,
			{} as never
		);
	});

	afterEach(() => {
		restore?.();
		jest.restoreAllMocks();
	});

	const listedFor = async (employeeId?: string) => {
		await service.findEmployeeRecentVisits({ ...(employeeId && { employeeId }) } as never);
		return findAll.mock.calls[0][0].where;
	};

	it('a viewer lists no visit, named employee or not', async () => {
		({ restore } = asTenantUser(createTenantFixture()));

		expect(await listedFor(VICTIM)).toMatchObject({ employeeId: In([]) });
		findAll.mockClear();
		expect(await listedFor()).toMatchObject({ employeeId: In([]) });
	});

	it('CONTROL: an employee lists their own visits, whatever the query names', async () => {
		({ restore } = asTenantUser(createTenantFixture({ user: { employeeId: 'own-employee' } as IUser })));

		expect(await listedFor(VICTIM)).toMatchObject({ employeeId: 'own-employee' });
	});

	it('CONTROL: a caller who may act for other employees lists the employee they name', async () => {
		({ restore } = asTenantUser(createTenantFixture(), {
			permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]
		}));

		expect(await listedFor(VICTIM)).toMatchObject({ employeeId: VICTIM });
	});
});
