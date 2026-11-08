import '../core/entities/internal';

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { from, lastValueFrom } from 'rxjs';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TransformInterceptor } from '../core/interceptors/transform.interceptor';
import { toNullableBillingRate } from '../shared/pipes/billing-rate.transform';
import { OrganizationProject } from './organization-project.entity';
import { OrganizationProjectEmployee } from './organization-project-employee.entity';
import { OrganizationProjectRateService } from './organization-project-rate.service';

/**
 * A project's client rate and a member's client rate on it are what the client is billed for the time. They are
 * written by someone who may edit every employee, or by a manager an admin flagged on that very project. The MANAGER
 * role alone is not enough (any employee who creates a project gets it), and a manager never sets their own rate.
 */

const TENANT = 'tenant-1';
const OTHER_TENANT = 'tenant-2';
const ORGANIZATION = 'organization-1';
const OTHER_ORGANIZATION = 'organization-2';
const HOME = { organizationId: ORGANIZATION, tenantId: TENANT };
const PROJECT = 'project-1';
const OTHER_PROJECT = 'project-2';
const FOREIGN_ORGANIZATION_PROJECT = 'project-of-organization-2';
const FOREIGN_TENANT_PROJECT = 'project-of-tenant-2';

interface ScopedRow {
	organizationId: string;
	tenantId: string;
}

interface ProjectRow extends ScopedRow {
	id: string;
	currency: string | null;
}

interface MembershipRow extends ScopedRow {
	id: string;
	organizationProjectId: string;
	employeeId: string;
	isManager: boolean;
	billRateValue: number | null;
	isArchived?: boolean;
}

const NO_CURRENCY_PROJECT = 'project-no-currency';

const PROJECTS: ProjectRow[] = [
	{ id: PROJECT, currency: 'EUR', ...HOME },
	{ id: OTHER_PROJECT, currency: 'EUR', ...HOME },
	{ id: NO_CURRENCY_PROJECT, currency: null, ...HOME },
	{ id: FOREIGN_ORGANIZATION_PROJECT, currency: 'EUR', organizationId: OTHER_ORGANIZATION, tenantId: TENANT },
	{ id: FOREIGN_TENANT_PROJECT, currency: 'EUR', organizationId: ORGANIZATION, tenantId: OTHER_TENANT }
];

const PROJECT_KEYS = ['id', 'organizationId', 'tenantId'];
const MEMBERSHIP_KEYS = ['organizationProjectId', 'employeeId', 'isManager', 'organizationId', 'tenantId'];

/** TypeORM drops an undefined `where` value, so a predicate the service leaves out matches every row. */
const matchesKeys = (row: object, where: Record<string, unknown>, keys: string[]) => {
	const values = row as Record<string, unknown>;
	return keys.every((key) => where[key] === undefined || values[key] === where[key]);
};

describe('OrganizationProjectRateService', () => {
	let permissions: PermissionsEnum[];
	let callerEmployeeId: string | null;
	let memberships: MembershipRow[];
	let projectUpdate: jest.Mock;
	let membershipUpdate: jest.Mock;
	let service: OrganizationProjectRateService;

	/** A condition on `isArchived` (the current-membership filter) leaves an archived row out, as the database does. */
	const matches = (row: MembershipRow, where: Record<string, unknown>) => {
		const matchesWhere = matchesKeys(row, where, MEMBERSHIP_KEYS);
		const skipsArchived = where.isArchived !== undefined;
		const isLeftOut = skipsArchived && row.isArchived === true;
		return matchesWhere && !isLeftOut;
	};

	const toMembershipEntity = (row: MembershipRow) => Object.assign(new OrganizationProjectEmployee(), row);

	beforeEach(() => {
		permissions = [];
		callerEmployeeId = 'manager-employee';
		memberships = [
			{
				id: 'm-manager',
				organizationProjectId: PROJECT,
				employeeId: 'manager-employee',
				isManager: true,
				billRateValue: null,
				...HOME
			},
			{
				id: 'm-member',
				organizationProjectId: PROJECT,
				employeeId: 'member-employee',
				isManager: false,
				billRateValue: 30,
				...HOME
			},
			{
				id: 'm-former',
				organizationProjectId: PROJECT,
				employeeId: 'former-employee',
				isManager: false,
				billRateValue: null,
				isArchived: true,
				...HOME
			},
			{
				id: 'm-role-only',
				organizationProjectId: OTHER_PROJECT,
				employeeId: 'creator-employee',
				isManager: false,
				billRateValue: null,
				...HOME
			},
			{
				id: 'm-other',
				organizationProjectId: OTHER_PROJECT,
				employeeId: 'manager-employee',
				isManager: false,
				billRateValue: null,
				...HOME
			},
			{
				id: 'm-foreign-organization',
				organizationProjectId: PROJECT,
				employeeId: 'foreign-organization-manager',
				isManager: true,
				billRateValue: 70,
				organizationId: OTHER_ORGANIZATION,
				tenantId: TENANT
			},
			{
				id: 'm-foreign-tenant',
				organizationProjectId: PROJECT,
				employeeId: 'foreign-tenant-manager',
				isManager: true,
				billRateValue: 90,
				organizationId: ORGANIZATION,
				tenantId: OTHER_TENANT
			}
		];
		projectUpdate = jest.fn(async () => ({ affected: 1 }));
		membershipUpdate = jest.fn(async () => ({ affected: 1 }));

		const projectRepository = {
			findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
				const row = PROJECTS.find((project) => matchesKeys(project, where, PROJECT_KEYS));
				if (!row) {
					return null;
				}
				return Object.assign(new OrganizationProject(), {
					id: row.id,
					billRateValue: 40,
					currency: row.currency
				});
			}),
			update: projectUpdate,
			manager: {
				findOne: jest.fn(async () => ({ id: ORGANIZATION, currency: 'USD' })),
				count: jest.fn(async () => 1)
			}
		};
		const membershipRepository = {
			exists: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
				memberships.some((row) => matches(row, where))
			),
			findOne: jest.fn(
				async ({ where }: { where: Record<string, unknown> }) =>
					memberships.find((row) => matches(row, where)) ?? null
			),
			find: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
				const rows = memberships.filter((row) => matches(row, where));
				return rows.map(toMembershipEntity);
			}),
			update: membershipUpdate
		};
		service = new OrganizationProjectRateService(projectRepository as never, membershipRepository as never);

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) =>
			permissions.includes(permission as PermissionsEnum)
		);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockImplementation(() => callerEmployeeId);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);
		jest.spyOn(RequestContext, 'hasRoles').mockReturnValue(false);
	});

	afterEach(() => jest.restoreAllMocks());

	const setProjectRate = (projectId: string, billRateValue: number | null) =>
		service.updateProjectRate(projectId, { organizationId: ORGANIZATION, billRateValue });

	const setMemberRate = (employeeId: string, billRateValue: number | null) =>
		service.updateMemberRate(PROJECT, employeeId, { organizationId: ORGANIZATION, billRateValue });

	describe('the project rate', () => {
		it.each([PermissionsEnum.ORG_EMPLOYEES_EDIT, PermissionsEnum.CHANGE_SELECTED_EMPLOYEE])(
			'is set by a holder of %s, in the project currency',
			async (permission) => {
				permissions = [permission];
				callerEmployeeId = null;

				await expect(setProjectRate(PROJECT, 55)).resolves.toEqual({
					id: PROJECT,
					billRateValue: 55,
					currency: 'EUR'
				});

				expect(projectUpdate).toHaveBeenCalledWith(
					{ id: PROJECT, organizationId: ORGANIZATION, tenantId: TENANT },
					{ billRateValue: 55 }
				);
			}
		);

		it('is set by a manager the project flags', async () => {
			await setProjectRate(PROJECT, 55);

			expect(projectUpdate).toHaveBeenCalledTimes(1);
		});

		it('is cleared with null', async () => {
			await setProjectRate(PROJECT, null);

			expect(projectUpdate).toHaveBeenCalledWith(expect.anything(), { billRateValue: null });
		});

		it('is refused to a plain member', async () => {
			callerEmployeeId = 'member-employee';

			await expect(setProjectRate(PROJECT, 55)).rejects.toThrow(ForbiddenException);
			expect(projectUpdate).not.toHaveBeenCalled();
		});

		it('is refused to a manager of another project, and to a manager by role alone', async () => {
			await expect(setProjectRate(OTHER_PROJECT, 55)).rejects.toThrow(ForbiddenException);

			callerEmployeeId = 'creator-employee';
			await expect(setProjectRate(OTHER_PROJECT, 55)).rejects.toThrow(ForbiddenException);

			expect(projectUpdate).not.toHaveBeenCalled();
		});

		it("answers the organization's currency for a project that states none", async () => {
			permissions = [PermissionsEnum.ORG_EMPLOYEES_EDIT];
			callerEmployeeId = null;

			await expect(setProjectRate(NO_CURRENCY_PROJECT, 55)).resolves.toEqual({
				id: NO_CURRENCY_PROJECT,
				billRateValue: 55,
				currency: 'USD'
			});
			await expect(service.findProjectRates(NO_CURRENCY_PROJECT, ORGANIZATION)).resolves.toEqual(
				expect.objectContaining({ id: NO_CURRENCY_PROJECT, currency: 'USD' })
			);
		});

		it('answers 404 to an admin for a project that does not exist', async () => {
			permissions = [PermissionsEnum.ORG_EMPLOYEES_EDIT];

			await expect(setProjectRate('missing-project', 55)).rejects.toThrow(NotFoundException);
		});
	});

	describe("a member's rate on the project", () => {
		it("is set by the project's flagged manager for a colleague", async () => {
			await expect(setMemberRate('member-employee', 35)).resolves.toEqual({
				organizationProjectId: PROJECT,
				employeeId: 'member-employee',
				billRateValue: 35
			});

			expect(membershipUpdate).toHaveBeenCalledWith({ id: 'm-member', tenantId: TENANT }, { billRateValue: 35 });
		});

		it('is never set by a manager for themselves', async () => {
			await expect(setMemberRate('manager-employee', 99)).rejects.toThrow(ForbiddenException);

			expect(membershipUpdate).not.toHaveBeenCalled();
		});

		it('is never set by a manager for themselves through their own id in another letter case', async () => {
			// The UUID pipe keeps the letter case of the route id, and Postgres matches a uuid in any case to the
			// stored row: an upper-case own id is still the manager's own.
			await expect(setMemberRate('MANAGER-EMPLOYEE', 99)).rejects.toThrow(ForbiddenException);

			expect(membershipUpdate).not.toHaveBeenCalled();
		});

		it('is set by an admin, their own included, and cleared with null', async () => {
			permissions = [PermissionsEnum.ORG_EMPLOYEES_EDIT];

			await setMemberRate('manager-employee', 50);
			await setMemberRate('member-employee', null);

			expect(membershipUpdate).toHaveBeenNthCalledWith(
				2,
				{ id: 'm-member', tenantId: TENANT },
				{ billRateValue: null }
			);
		});

		it('answers 404 for an employee who is not a member of the project', async () => {
			await expect(setMemberRate('stranger-employee', 35)).rejects.toThrow(NotFoundException);
		});

		it('answers 404 for a former member, whose archived membership keeps its old rate', async () => {
			permissions = [PermissionsEnum.ORG_EMPLOYEES_EDIT];

			await expect(setMemberRate('former-employee', 35)).rejects.toThrow(NotFoundException);
			expect(membershipUpdate).not.toHaveBeenCalled();
		});

		it('is refused to a plain member', async () => {
			callerEmployeeId = 'member-employee';

			await expect(setMemberRate('manager-employee', 35)).rejects.toThrow(ForbiddenException);
		});
	});

	it("lists the project's rate and its members' rates to the project's manager", async () => {
		const rates = await service.findProjectRates(PROJECT, ORGANIZATION);

		expect(rates).toEqual({
			id: PROJECT,
			billRateValue: 40,
			currency: 'EUR',
			members: [
				{ employeeId: 'manager-employee', billRateValue: null },
				{ employeeId: 'member-employee', billRateValue: 30 }
			]
		});
	});

	it('keeps the rates read from entity rows in the body the API answers', async () => {
		const rates = service.findProjectRates(PROJECT, ORGANIZATION);
		const handler = { handle: () => from(rates) };

		const body = await lastValueFrom(new TransformInterceptor().intercept({} as never, handler));

		expect(body).toEqual({
			id: PROJECT,
			billRateValue: 40,
			currency: 'EUR',
			members: [
				{ employeeId: 'manager-employee', billRateValue: null },
				{ employeeId: 'member-employee', billRateValue: 30 }
			]
		});
	});

	it('refuses the list to a plain member', async () => {
		callerEmployeeId = 'member-employee';

		await expect(service.findProjectRates(PROJECT, ORGANIZATION)).rejects.toThrow(ForbiddenException);
	});

	it('refuses an admin a body that names no organization, before reading or writing any rate', async () => {
		permissions = [PermissionsEnum.ORG_EMPLOYEES_EDIT];
		const withoutOrganization = { organizationId: undefined as never, billRateValue: 55 };

		await expect(service.findProjectRates(PROJECT, undefined as never)).rejects.toThrow(BadRequestException);
		await expect(service.updateProjectRate(PROJECT, withoutOrganization)).rejects.toThrow(BadRequestException);
		await expect(service.updateMemberRate(PROJECT, 'member-employee', withoutOrganization)).rejects.toThrow(
			BadRequestException
		);

		expect(projectUpdate).not.toHaveBeenCalled();
		expect(membershipUpdate).not.toHaveBeenCalled();
	});

	describe('another organization or tenant', () => {
		it.each(['foreign-organization-manager', 'foreign-tenant-manager'])(
			'does not let in %s, flagged manager of the project there',
			async (employeeId) => {
				callerEmployeeId = employeeId;

				await expect(service.findProjectRates(PROJECT, ORGANIZATION)).rejects.toThrow(ForbiddenException);
				await expect(setProjectRate(PROJECT, 55)).rejects.toThrow(ForbiddenException);

				expect(projectUpdate).not.toHaveBeenCalled();
			}
		);

		it.each([FOREIGN_ORGANIZATION_PROJECT, FOREIGN_TENANT_PROJECT])(
			'answers 404 to an admin for %s',
			async (projectId) => {
				permissions = [PermissionsEnum.ORG_EMPLOYEES_EDIT];

				await expect(service.findProjectRates(projectId, ORGANIZATION)).rejects.toThrow(NotFoundException);
				await expect(setProjectRate(projectId, 55)).rejects.toThrow(NotFoundException);

				expect(projectUpdate).not.toHaveBeenCalled();
			}
		);

		it.each(['foreign-organization-manager', 'foreign-tenant-manager'])(
			'answers 404 to an admin setting the rate of %s, a member there',
			async (employeeId) => {
				permissions = [PermissionsEnum.ORG_EMPLOYEES_EDIT];

				await expect(setMemberRate(employeeId, 35)).rejects.toThrow(NotFoundException);

				expect(membershipUpdate).not.toHaveBeenCalled();
			}
		);
	});
});

describe('toNullableBillingRate', () => {
	const transform = (value: unknown) => toNullableBillingRate({ value } as never);

	it('keeps null (a cleared rate) and a missing value (refused by the DTO), and rounds a rate to cents', () => {
		expect(transform(null)).toBeNull();
		expect(transform(undefined)).toBeUndefined();
		expect(transform('12.345')).toBe(12.35);
		expect(transform(25)).toBe(25);
	});
});
