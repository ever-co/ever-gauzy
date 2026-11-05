import '../core/entities/internal';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CurrenciesEnum, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { EmployeeService } from './employee.service';

/**
 * A pay rate is salary data. The employee reads their own, and a holder of ORG_EMPLOYEES_EDIT reads and sets anyone's;
 * a teammate reads nothing. Changing one's own pay rate needs CHANGE_OWN_RATES, which SUPER_ADMIN and ADMIN hold by
 * default.
 */

const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';

describe('EmployeeService pay rate', () => {
	let permissions: PermissionsEnum[];
	let callerEmployeeId: string | null;
	let stored: Record<string, { payRateValue: string | null; payRateCurrency: CurrenciesEnum | null }>;
	let find: jest.Mock;
	let service: EmployeeService;

	beforeEach(() => {
		permissions = [];
		callerEmployeeId = 'employee-ana';
		stored = {
			'employee-ana': { payRateValue: '30.00', payRateCurrency: null },
			'employee-ben': { payRateValue: '7.00', payRateCurrency: CurrenciesEnum.EUR }
		};
		find = jest.fn(async (_entity: unknown, { where }: any) => {
			const ids: string[] = where.id.value;
			const known = ids.filter((id) => stored[id]);
			return known.map((id) => ({ id, ...stored[id] }));
		});
		const manager = {
			find,
			findOne: jest.fn(async () => ({ id: ORGANIZATION, currency: CurrenciesEnum.USD })),
			count: jest.fn(async () => 1)
		};
		service = Object.create(EmployeeService.prototype);
		Object.assign(service, { typeOrmRepository: { manager } });

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);
		jest.spyOn(RequestContext, 'hasRoles').mockReturnValue(false);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockImplementation(() => callerEmployeeId);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: 'user-1',
			employeeId: 'employee-ana'
		} as never);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) =>
			permissions.includes(permission as PermissionsEnum)
		);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('reading it', () => {
		it("answers the employee their own pay rate, in the organization's currency when it states none", async () => {
			await expect(service.findPayRate('employee-ana', ORGANIZATION)).resolves.toEqual({
				employeeId: 'employee-ana',
				payRateValue: 30,
				payRateCurrency: null,
				currency: CurrenciesEnum.USD
			});
		});

		it('answers a holder of CHANGE_SELECTED_EMPLOYEE their own, whose context names no employee', async () => {
			permissions = [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE];
			callerEmployeeId = null;

			await expect(service.findPayRate('employee-ana', ORGANIZATION)).resolves.toMatchObject({
				employeeId: 'employee-ana',
				payRateValue: 30
			});
			await expect(service.findPayRate('employee-ben', ORGANIZATION)).rejects.toThrow(ForbiddenException);
		});

		it("answers a rate editor anyone's pay rate", async () => {
			permissions = [PermissionsEnum.ORG_EMPLOYEES_EDIT];

			await expect(service.findPayRate('employee-ben', ORGANIZATION)).resolves.toEqual({
				employeeId: 'employee-ben',
				payRateValue: 7,
				payRateCurrency: CurrenciesEnum.EUR,
				currency: CurrenciesEnum.EUR
			});
		});

		it("refuses a teammate's pay rate to an employee, a manager by view rights included, before reading it", async () => {
			permissions = [PermissionsEnum.ORG_EMPLOYEES_VIEW, PermissionsEnum.CHANGE_SELECTED_EMPLOYEE];

			await expect(service.findPayRate('employee-ben', ORGANIZATION)).rejects.toThrow(ForbiddenException);
			expect(find).not.toHaveBeenCalled();
		});

		it('refuses a request that names no organization', async () => {
			permissions = [PermissionsEnum.ORG_EMPLOYEES_EDIT];

			await expect(service.findPayRate('employee-ben', undefined as never)).rejects.toThrow(BadRequestException);
			expect(find).not.toHaveBeenCalled();
		});
	});

	describe("editing one's own record", () => {
		it('refuses an employee without CHANGE_OWN_RATES a change of their own pay rate', async () => {
			await expect(service.assertOwnPayRateUnchanged('employee-ana', { payRateValue: 45 })).rejects.toThrow(
				ForbiddenException
			);
			await expect(
				service.assertOwnPayRateUnchanged('employee-ana', { payRateCurrency: CurrenciesEnum.EUR })
			).rejects.toThrow(ForbiddenException);
			await expect(service.assertOwnPayRateUnchanged('employee-ana', { payRateValue: null })).rejects.toThrow(
				ForbiddenException
			);
		});

		it('lets a holder of CHANGE_OWN_RATES, an admin or owner by default, set their own pay rate', async () => {
			permissions = [PermissionsEnum.CHANGE_OWN_RATES];

			await expect(
				service.assertOwnPayRateUnchanged('employee-ana', { payRateValue: 45 })
			).resolves.toBeUndefined();
			expect(find).not.toHaveBeenCalled();
		});

		it('refuses the change when the own id is sent in another letter case', async () => {
			permissions = [PermissionsEnum.ORG_EMPLOYEES_EDIT];

			await expect(service.assertOwnPayRateUnchanged('EMPLOYEE-ANA', { payRateValue: 45 })).rejects.toThrow(
				ForbiddenException
			);
		});

		it('refuses a holder of ORG_EMPLOYEES_EDIT alone a change of their own pay rate', async () => {
			permissions = [PermissionsEnum.ORG_EMPLOYEES_EDIT];

			await expect(service.assertOwnPayRateUnchanged('employee-ana', { payRateValue: 45 })).rejects.toThrow(
				ForbiddenException
			);
		});

		it("lets an employee's own save that sends the stored pay rate again, or none, through", async () => {
			await expect(
				service.assertOwnPayRateUnchanged('employee-ana', { payRateValue: 30, payRateCurrency: null })
			).resolves.toBeUndefined();
			await expect(
				service.assertOwnPayRateUnchanged('employee-ana', { billRateValue: 80 })
			).resolves.toBeUndefined();
		});

		it("lets a rate editor set someone else's pay rate", async () => {
			permissions = [PermissionsEnum.ORG_EMPLOYEES_EDIT];

			await expect(
				service.assertOwnPayRateUnchanged('employee-ben', { payRateValue: 9 })
			).resolves.toBeUndefined();
			expect(find).not.toHaveBeenCalled();
		});
	});
});
