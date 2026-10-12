import 'reflect-metadata';
import { BadRequestException, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { canViewTrackedData, EmployeeTrackedDataGuard } from './employee-tracked-data.guard';

/**
 * The repositories are backed by in-memory rows and evaluate the guard's real where-clauses
 * (tenant, organization, isManager, isActive, isArchived), so the spec exercises the actual
 * membership and tenant rules instead of mocked answers.
 */
describe('EmployeeTrackedDataGuard', () => {
	const TENANT = 'b7c8d9e0-f1a2-4b3c-9d4e-5f6a7b8c9d0e';
	const OTHER_TENANT = 'e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b';
	const ORG_A = '6f1c1e2a-3b4d-4c5e-8f60-718293a4b5c6';
	const ORG_B = '0d9e8f7a-6b5c-4d3e-9f21-a0b1c2d3e4f5';
	const ORG_OTHER_TENANT = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
	const EMPLOYEE = 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f';
	const USER = 'd4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f70';

	const HIDDEN_MESSAGE = 'Employees are not allowed to view tracked data in this organization';

	let rows: {
		Employee: any[];
		Organization: any[];
		OrganizationTeamEmployee: any[];
		OrganizationProjectEmployee: any[];
	};
	let dataSource: DataSource;
	let repositories: Record<string, { findOne: jest.Mock; find: jest.Mock; existsBy: jest.Mock }>;
	let getRepository: jest.Mock;
	let guard: EmployeeTrackedDataGuard;

	const isFindOperator = (value: any): boolean => typeof value?.type === 'string' && 'value' in value;

	const matches = (row: any, where: Record<string, unknown>) =>
		Object.entries(where).every(([key, value]: [string, any]) => {
			if (isFindOperator(value)) {
				// In([...])
				return [].concat(value.value).includes(row[key]);
			}
			if (value && typeof value === 'object') {
				return matches(row[key] ?? {}, value as Record<string, unknown>);
			}
			return row[key] === value;
		});

	const membership = (overrides: Record<string, unknown> = {}) => ({
		employeeId: EMPLOYEE,
		organizationId: ORG_A,
		tenantId: TENANT,
		isManager: true,
		isActive: true,
		isArchived: false,
		...overrides
	});

	function setOrganizations(settings: Record<string, unknown>) {
		rows.Organization = Object.entries(settings).map(([id, allowEmployeeToSeeTrackedData]) => ({
			id,
			tenantId: id === ORG_OTHER_TENANT ? OTHER_TENANT : TENANT,
			allowEmployeeToSeeTrackedData
		}));
	}

	function createContext(request: { query?: any; body?: any; params?: any } = {}): ExecutionContext {
		return {
			switchToHttp: () => ({
				getRequest: () => ({ method: 'GET', query: {}, params: {}, ...request })
			})
		} as unknown as ExecutionContext;
	}

	beforeEach(() => {
		rows = {
			Employee: [{ id: EMPLOYEE, userId: USER, tenantId: TENANT, organizationId: ORG_A }],
			Organization: [],
			OrganizationTeamEmployee: [],
			OrganizationProjectEmployee: []
		};
		setOrganizations({ [ORG_A]: true, [ORG_B]: true, [ORG_OTHER_TENANT]: true });

		repositories = Object.fromEntries(
			Object.keys(rows).map((name) => [
				name,
				{
					findOne: jest.fn(async ({ where }) => rows[name].find((row) => matches(row, where)) ?? null),
					find: jest.fn(async ({ where }) => rows[name].filter((row) => matches(row, where))),
					existsBy: jest.fn(async (where) => rows[name].some((row) => matches(row, where)))
				}
			])
		);
		getRepository = jest.fn((name: string) => repositories[name]);
		dataSource = { getRepository } as unknown as DataSource;
		guard = new EmployeeTrackedDataGuard(dataSource);

		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		// No organization claim on the token by default, so the employee record resolves the organization
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(USER);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: USER,
			employeeId: EMPLOYEE,
			tenantId: TENANT
		} as any);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('depends on the global DataSource only, so any module (plugins included) can resolve it', () => {
		expect(Reflect.getMetadata('design:paramtypes', EmployeeTrackedDataGuard)).toEqual([DataSource]);
	});

	describe('exempt callers', () => {
		it('allows CHANGE_SELECTED_EMPLOYEE holders without touching the database', async () => {
			setOrganizations({ [ORG_A]: false });
			jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
				(permission) => permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			);

			await expect(guard.canActivate(createContext({ query: { organizationId: ORG_A } }))).resolves.toBe(true);
			expect(getRepository).not.toHaveBeenCalled();
		});

		it('allows a caller who has no employee record in the tenant (role-based access)', async () => {
			setOrganizations({ [ORG_A]: false });
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: USER, tenantId: TENANT } as any);
			rows.Employee = [];

			await expect(guard.canActivate(createContext({ query: { organizationId: ORG_A } }))).resolves.toBe(true);
			await expect(guard.canActivate(createContext())).resolves.toBe(true);
		});

		it('does not exempt a token without an employee claim while the user is an employee in the tenant', async () => {
			// POST /auth/switch-organization mints such a token for an organization where the user has no
			// employee record; the setting of the organization their employee record lives in still applies
			setOrganizations({ [ORG_A]: false, [ORG_B]: true });
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: USER, tenantId: TENANT } as any);
			jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG_B);

			await expect(guard.canActivate(createContext({ query: { organizationId: ORG_B } }))).rejects.toThrow(
				new ForbiddenException(HIDDEN_MESSAGE)
			);
		});

		it('still exempts such a token when the user manages a team in the restricted organization', async () => {
			setOrganizations({ [ORG_A]: false, [ORG_B]: true });
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: USER, tenantId: TENANT } as any);
			jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG_B);
			rows.OrganizationTeamEmployee = [membership()];

			await expect(guard.canActivate(createContext({ query: { organizationId: ORG_B } }))).resolves.toBe(true);
		});
	});

	describe('setting on (the default)', () => {
		it('allows an employee whose organization has the setting on', async () => {
			await expect(guard.canActivate(createContext({ query: { organizationId: ORG_A } }))).resolves.toBe(true);
		});

		it('uses the employee organization when the request names none (GET without body)', async () => {
			await expect(guard.canActivate(createContext({ body: undefined }))).resolves.toBe(true);
		});

		it('takes the organization from the token without an employee lookup when the token carries one', async () => {
			jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG_A);
			await expect(guard.canActivate(createContext())).resolves.toBe(true);
			expect(repositories.Employee.findOne).not.toHaveBeenCalled();
			expect(repositories.Employee.find).not.toHaveBeenCalled();
		});

		it('treats a missing value as on', async () => {
			rows.Organization = [{ id: ORG_A, tenantId: TENANT }];
			await expect(guard.canActivate(createContext())).resolves.toBe(true);
		});
	});

	describe('setting off', () => {
		beforeEach(() => {
			setOrganizations({ [ORG_A]: false, [ORG_B]: true });
		});

		it('blocks a regular employee', async () => {
			await expect(guard.canActivate(createContext({ query: { organizationId: ORG_A } }))).rejects.toThrow(
				new ForbiddenException(HIDDEN_MESSAGE)
			);
		});

		it('blocks when the request names no organization (the employee organization still applies)', async () => {
			await expect(guard.canActivate(createContext())).rejects.toThrow(new ForbiddenException(HIDDEN_MESSAGE));
		});

		it('treats a raw tinyint 0 as off', async () => {
			rows.Organization = [{ id: ORG_A, tenantId: TENANT, allowEmployeeToSeeTrackedData: 0 }];
			await expect(guard.canActivate(createContext())).rejects.toThrow(new ForbiddenException(HIDDEN_MESSAGE));
		});

		it('allows an active team manager in the organization', async () => {
			rows.OrganizationTeamEmployee = [membership()];
			await expect(guard.canActivate(createContext({ query: { organizationId: ORG_A } }))).resolves.toBe(true);
		});

		it('allows a team member holding the MANAGER role (the team flows set the role, not isManager)', async () => {
			rows.OrganizationTeamEmployee = [membership({ isManager: false, role: { name: RolesEnum.MANAGER } })];
			await expect(guard.canActivate(createContext({ query: { organizationId: ORG_A } }))).resolves.toBe(true);
		});

		it('blocks a team member holding a non-manager role', async () => {
			rows.OrganizationTeamEmployee = [membership({ isManager: false, role: { name: RolesEnum.EMPLOYEE } })];
			await expect(guard.canActivate(createContext({ query: { organizationId: ORG_A } }))).rejects.toThrow(
				new ForbiddenException(HIDDEN_MESSAGE)
			);
		});

		it('allows an active project manager in the organization', async () => {
			rows.OrganizationProjectEmployee = [membership()];
			await expect(guard.canActivate(createContext({ query: { organizationId: ORG_A } }))).resolves.toBe(true);
		});

		it.each([
			['a plain team member', { isManager: false }],
			['an inactive team manager', { isActive: false }],
			['an archived team manager', { isArchived: true }],
			['a team manager in another organization', { organizationId: ORG_B }],
			['a team manager in another tenant', { tenantId: OTHER_TENANT }]
		])('blocks %s', async (_label, overrides) => {
			rows.OrganizationTeamEmployee = [membership(overrides)];
			rows.OrganizationProjectEmployee = [membership(overrides)];
			await expect(guard.canActivate(createContext({ query: { organizationId: ORG_A } }))).rejects.toThrow(
				new ForbiddenException(HIDDEN_MESSAGE)
			);
		});
	});

	describe('a client-chosen organizationId cannot bypass the setting', () => {
		it('blocks when the query names another organization that has the setting on', async () => {
			setOrganizations({ [ORG_A]: false, [ORG_B]: true });
			await expect(guard.canActivate(createContext({ query: { organizationId: ORG_B } }))).rejects.toThrow(
				new ForbiddenException(HIDDEN_MESSAGE)
			);
		});

		it('checks the query and the body organization (POST handlers read the body)', async () => {
			setOrganizations({ [ORG_A]: true, [ORG_B]: false });
			const context = createContext({ query: { organizationId: ORG_A }, body: { organizationId: ORG_B } });
			await expect(guard.canActivate(context)).rejects.toThrow(new ForbiddenException(HIDDEN_MESSAGE));
		});

		it('blocks when a requested organization has the setting off, even if the employee organization has it on', async () => {
			setOrganizations({ [ORG_A]: true, [ORG_B]: false });
			await expect(guard.canActivate(createContext({ query: { organizationId: ORG_B } }))).rejects.toThrow(
				new ForbiddenException(HIDDEN_MESSAGE)
			);
		});

		it('requires the manager exemption in every organization where the setting is off', async () => {
			setOrganizations({ [ORG_A]: false, [ORG_B]: false });
			rows.OrganizationTeamEmployee = [membership({ organizationId: ORG_A })];
			await expect(guard.canActivate(createContext({ query: { organizationId: ORG_B } }))).rejects.toThrow(
				new ForbiddenException(HIDDEN_MESSAGE)
			);
		});
	});

	describe('organizations that carry no setting do not change the answer', () => {
		it('ignores an organization of another tenant while the own organization allows it (as on develop)', async () => {
			await expect(
				guard.canActivate(createContext({ query: { organizationId: ORG_OTHER_TENANT } }))
			).resolves.toBe(true);
		});

		it('still blocks when the own organization has the setting off', async () => {
			setOrganizations({ [ORG_A]: false, [ORG_OTHER_TENANT]: true });
			await expect(
				guard.canActivate(createContext({ query: { organizationId: ORG_OTHER_TENANT } }))
			).rejects.toThrow(new ForbiddenException(HIDDEN_MESSAGE));
		});

		it('allows when neither the token nor the employee record names an organization', async () => {
			rows.Employee = [{ id: EMPLOYEE, userId: USER, tenantId: OTHER_TENANT, organizationId: ORG_A }];
			await expect(guard.canActivate(createContext())).resolves.toBe(true);
		});

		it('rejects a request without tenant context', async () => {
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null);
			await expect(guard.canActivate(createContext())).rejects.toThrow(
				new ForbiddenException('Tenant context is required to access tracked data')
			);
			expect(getRepository).not.toHaveBeenCalled();
		});
	});

	describe('malformed organizationId', () => {
		it.each([
			['a non-UUID string', 'abc'],
			['a SQL fragment', `${ORG_A}' OR '1'='1`],
			['a repeated parameter', [ORG_A, ORG_B]],
			['a structured parameter', { $ne: ORG_A }],
			['a number', 42]
		])('returns 400 for %s before any database access', async (_label, organizationId) => {
			await expect(guard.canActivate(createContext({ query: { organizationId } }))).rejects.toThrow(
				new BadRequestException('Invalid organizationId')
			);
			expect(getRepository).not.toHaveBeenCalled();
		});
	});

	describe('canViewTrackedData (used by GET /timesheet/statistics/tracked-data-access)', () => {
		it('returns false instead of throwing when the setting hides tracked data', async () => {
			setOrganizations({ [ORG_A]: false });
			await expect(canViewTrackedData(dataSource, [ORG_A])).resolves.toBe(false);
		});

		it('returns true for a manager and ignores empty values', async () => {
			setOrganizations({ [ORG_A]: false });
			rows.OrganizationTeamEmployee = [membership()];
			await expect(canViewTrackedData(dataSource, [undefined, null, ''])).resolves.toBe(true);
		});

		it('answers for the caller own organization when called without arguments', async () => {
			setOrganizations({ [ORG_A]: false });
			await expect(canViewTrackedData(dataSource)).resolves.toBe(false);
		});
	});
});
