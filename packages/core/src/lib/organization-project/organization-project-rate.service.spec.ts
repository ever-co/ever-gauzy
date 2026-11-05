import '../core/entities/internal';

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { toNullableBillingRate } from '../shared/pipes/billing-rate.transform';
import { OrganizationProjectRateService } from './organization-project-rate.service';

/**
 * A project's client rate and a member's client rate on it are what the client is billed for the time. They are
 * written by someone who may edit every employee, or by a manager an admin flagged on that very project. The MANAGER
 * role alone is not enough (any employee who creates a project gets it), and a manager never sets their own rate.
 */

const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';
const PROJECT = 'project-1';
const OTHER_PROJECT = 'project-2';

interface MembershipRow {
	id: string;
	organizationProjectId: string;
	employeeId: string;
	isManager: boolean;
	billRateValue: number | null;
}

describe('OrganizationProjectRateService', () => {
	let permissions: PermissionsEnum[];
	let callerEmployeeId: string | null;
	let memberships: MembershipRow[];
	let projectUpdate: jest.Mock;
	let membershipUpdate: jest.Mock;
	let service: OrganizationProjectRateService;

	const matches = (row: MembershipRow, where: Record<string, unknown>) => {
		const keys = ['organizationProjectId', 'employeeId', 'isManager'] as const;
		return keys.every((key) => where[key] === undefined || row[key] === where[key]);
	};

	beforeEach(() => {
		permissions = [];
		callerEmployeeId = 'manager-employee';
		memberships = [
			{
				id: 'm-manager',
				organizationProjectId: PROJECT,
				employeeId: 'manager-employee',
				isManager: true,
				billRateValue: null
			},
			{
				id: 'm-member',
				organizationProjectId: PROJECT,
				employeeId: 'member-employee',
				isManager: false,
				billRateValue: 30
			},
			{
				id: 'm-role-only',
				organizationProjectId: OTHER_PROJECT,
				employeeId: 'creator-employee',
				isManager: false,
				billRateValue: null
			},
			{
				id: 'm-other',
				organizationProjectId: OTHER_PROJECT,
				employeeId: 'manager-employee',
				isManager: false,
				billRateValue: null
			}
		];
		projectUpdate = jest.fn(async () => ({ affected: 1 }));
		membershipUpdate = jest.fn(async () => ({ affected: 1 }));

		const projectRepository = {
			findOne: jest.fn(async ({ where }: { where: { id: string } }) => {
				const known = [PROJECT, OTHER_PROJECT].includes(where.id);
				if (!known) {
					return null;
				}
				return { id: where.id, billRateValue: 40, currency: 'EUR' };
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
			find: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
				memberships.filter((row) => matches(row, where))
			),
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
