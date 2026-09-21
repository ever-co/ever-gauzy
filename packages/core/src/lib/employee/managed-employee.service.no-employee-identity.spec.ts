import '../core/entities/internal';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { ManagedEmployeeService, NO_ACCESSIBLE_EMPLOYEE_ID } from './managed-employee.service';

const TENANT_ID = '5a1c2f0e-6d3b-4c8a-9e2f-1b7d4a6c8e90';
const USER_ID = 'c3b2a190-8f7e-4d6c-9b5a-4e3d2c1b0a9f';
const OWN_EMPLOYEE_ID = '7e6d5c4b-3a29-4180-9f8e-7d6c5b4a3928';
const OTHER_EMPLOYEE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

/**
 * The tracked-data queries apply their employee predicate only when the id list is non-empty
 * (`if (isNotEmpty(employeeIds))`). An empty list therefore means "do not filter", so returning one for a
 * caller with no employee identity answered with the whole organization. Such a token is not exotic:
 * `POST /auth/switch-organization` mints one for an organization the user belongs to without being an
 * employee there, and CHANGE_SELECTED_ORGANIZATION is a default EMPLOYEE permission.
 */
describe('ManagedEmployeeService — a caller with no employee identity', () => {
	let service: ManagedEmployeeService;

	const actAs = (caller: { user: unknown; permissions?: PermissionsEnum[] }) => {
		const granted = caller.permissions ?? [];
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue(caller.user as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) => granted.includes(permission));
	};

	beforeEach(() => {
		service = new ManagedEmployeeService({} as any, {} as any);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('returns an id that matches nothing, so the query stays filtered', async () => {
		actAs({ user: { id: USER_ID, tenantId: TENANT_ID } });

		await expect(service.filterAccessibleEmployeeIds([OTHER_EMPLOYEE_ID])).resolves.toEqual([
			NO_ACCESSIBLE_EMPLOYEE_ID
		]);
	});

	it('does the same when the request names no employee at all', async () => {
		actAs({ user: { id: USER_ID, tenantId: TENANT_ID } });

		await expect(service.filterAccessibleEmployeeIds()).resolves.toEqual([NO_ACCESSIBLE_EMPLOYEE_ID]);
	});

	it('keeps the requested ids for an organization-wide viewer', async () => {
		actAs({ user: { id: USER_ID, tenantId: TENANT_ID }, permissions: [PermissionsEnum.ALL_ORG_VIEW] });

		await expect(service.filterAccessibleEmployeeIds([OTHER_EMPLOYEE_ID])).resolves.toEqual([OTHER_EMPLOYEE_ID]);
	});

	it('leaves a request with no user at all alone (public share links, internal calls)', async () => {
		actAs({ user: null });

		await expect(service.filterAccessibleEmployeeIds([OTHER_EMPLOYEE_ID])).resolves.toEqual([OTHER_EMPLOYEE_ID]);
	});

	it('still pins a normal employee to their own id', async () => {
		actAs({ user: { id: USER_ID, tenantId: TENANT_ID, employeeId: OWN_EMPLOYEE_ID } });

		await expect(service.filterAccessibleEmployeeIds([OTHER_EMPLOYEE_ID])).resolves.toEqual([OWN_EMPLOYEE_ID]);
	});

	it('still lets a CHANGE_SELECTED_EMPLOYEE holder ask for anyone', async () => {
		actAs({
			user: { id: USER_ID, tenantId: TENANT_ID },
			permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]
		});

		await expect(service.filterAccessibleEmployeeIds([OTHER_EMPLOYEE_ID])).resolves.toEqual([OTHER_EMPLOYEE_ID]);
	});

	it('uses the nil UUID, which is a valid value to compare against a uuid column', () => {
		expect(NO_ACCESSIBLE_EMPLOYEE_ID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
	});
});
