import '../../core/entities/internal';

import { ID, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { NO_ACCESSIBLE_EMPLOYEE_ID } from '../../employee/managed-employee.service';
import { StatisticService } from './statistic.service';

const TENANT_ID = '9d347c5c-5b96-4ef3-9799-b5fa0ca09111';
const USER_ID = '2f4b6d8a-0c1e-4a3b-8d5f-6e7a8b9c0d1e';
const OWN_EMPLOYEE_ID = '619ec3c7-498d-4c28-8b74-48da57cc5564';
const OTHER_EMPLOYEE_ID = '12128029-8b07-45a0-9690-181a66a660fc';

/**
 * The counts queries scope their employee predicate by hand rather than through ManagedEmployeeService,
 * and applied it only `if (user.employeeId && ...)`. A token with no employee identity therefore left the
 * predicate off entirely and answered with the whole organization — see
 * `managed-employee.service.no-employee-identity.spec.ts` for the same defect on the shared path.
 */
class TestStatisticService extends StatisticService {
	restrict(employeeIds: ID[] = [], onlyMe = false): ID[] {
		return this.restrictToAccessibleEmployees(employeeIds, onlyMe);
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
			{} as any
		);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('pins an authenticated caller with no employee identity to an id that matches nothing', () => {
		actAs({ user: { id: USER_ID, tenantId: TENANT_ID } });

		expect(service.restrict([OTHER_EMPLOYEE_ID])).toEqual([NO_ACCESSIBLE_EMPLOYEE_ID]);
		expect(service.restrict()).toEqual([NO_ACCESSIBLE_EMPLOYEE_ID]);
	});

	it('keeps the requested ids for an organization-wide viewer', () => {
		actAs({ user: { id: USER_ID, tenantId: TENANT_ID }, permissions: [PermissionsEnum.ALL_ORG_VIEW] });

		expect(service.restrict([OTHER_EMPLOYEE_ID])).toEqual([OTHER_EMPLOYEE_ID]);
	});

	it('leaves a request with no user at all alone (public share links, internal calls)', () => {
		actAs({ user: null });

		expect(service.restrict([OTHER_EMPLOYEE_ID])).toEqual([OTHER_EMPLOYEE_ID]);
	});

	it('pins a normal employee to their own id', () => {
		actAs({ user: { id: USER_ID, tenantId: TENANT_ID, employeeId: OWN_EMPLOYEE_ID } });

		expect(service.restrict([OTHER_EMPLOYEE_ID])).toEqual([OWN_EMPLOYEE_ID]);
	});

	it('lets a CHANGE_SELECTED_EMPLOYEE holder ask for anyone, and honours onlyMe', () => {
		actAs({
			user: { id: USER_ID, tenantId: TENANT_ID, employeeId: OWN_EMPLOYEE_ID },
			permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]
		});

		expect(service.restrict([OTHER_EMPLOYEE_ID])).toEqual([OTHER_EMPLOYEE_ID]);
		expect(service.restrict([OTHER_EMPLOYEE_ID], true)).toEqual([OWN_EMPLOYEE_ID]);
	});
});
