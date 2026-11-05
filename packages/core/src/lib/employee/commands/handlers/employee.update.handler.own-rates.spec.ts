// Only the shape of the services is needed: the real ones pull the whole core entity graph in.
jest.mock('./../../employee.service', () => ({ EmployeeService: class EmployeeService {} }));
jest.mock('./../../../activity-log/activity-log.service', () => ({ ActivityLogService: class ActivityLogService {} }));

import { ForbiddenException } from '@nestjs/common';
import { CurrenciesEnum, IEmployeeUpdateInput, PayPeriodEnum, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from './../../../core/context';
import { EmployeeUpdateCommand } from './../employee.update.command';
import { EmployeeUpdateHandler } from './employee.update.handler';

/**
 * Any employee could change their own bill rate, currency, minimum billing rate, pay period and weekly limit through
 * their profile. An organization that pays or bills its employees' time can now turn that off: the employee's
 * profile still saves, the rates do not change, and an admin keeps editing them.
 */
describe('EmployeeUpdateHandler — an employee changing their own rates', () => {
	const OWN_ID = 'employee-own';
	const OTHER_ID = 'employee-other';

	let create: jest.Mock;
	let handler: EmployeeUpdateHandler;
	let allowEmployeesToEditOwnRates: boolean | undefined;
	let permissions: PermissionsEnum[];

	const stored = (id: string) => ({
		id,
		billRateValue: 25,
		billRateCurrency: CurrenciesEnum.USD,
		minimumBillingRate: null,
		payPeriod: PayPeriodEnum.WEEKLY,
		reWeeklyLimit: 40,
		organization: { id: 'organization-1', allowEmployeesToEditOwnRates }
	});

	const update = (id: string, input: IEmployeeUpdateInput) => handler.execute(new EmployeeUpdateCommand(id, input));

	beforeEach(() => {
		allowEmployeesToEditOwnRates = false;
		permissions = [PermissionsEnum.PROFILE_EDIT];
		create = jest.fn(async (entity) => entity);
		const employeeService = {
			findOneByIdString: jest.fn(async (id: string) => stored(id)),
			create
		};
		handler = new EmployeeUpdateHandler(employeeService as any, {} as any, { publish: jest.fn() } as any);

		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-own', employeeId: OWN_ID } as any);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) =>
			permissions.includes(permission as PermissionsEnum)
		);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		['billRateValue', { billRateValue: 30 }],
		['billRateCurrency', { billRateCurrency: CurrenciesEnum.EUR }],
		['minimumBillingRate', { minimumBillingRate: 10 }],
		['payPeriod', { payPeriod: PayPeriodEnum.MONTHLY }],
		['reWeeklyLimit', { reWeeklyLimit: 60 }]
	])('refuses a change of %s when the organization locked own rates, and saves nothing', async (_field, input) => {
		await expect(update(OWN_ID, input as IEmployeeUpdateInput)).rejects.toThrow(ForbiddenException);

		expect(create).not.toHaveBeenCalled();
	});

	it('saves a profile that sends the unchanged rates with it, compared as values', async () => {
		await update(OWN_ID, {
			billRateValue: '25.00' as unknown as number,
			billRateCurrency: CurrenciesEnum.USD,
			minimumBillingRate: 0,
			payPeriod: PayPeriodEnum.WEEKLY,
			reWeeklyLimit: 40,
			githubUrl: 'https://github.com/someone'
		});

		expect(create).toHaveBeenCalledTimes(1);
	});

	it('saves a social links only edit', async () => {
		await update(OWN_ID, { linkedInUrl: 'https://linkedin.com/in/someone' });

		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({ linkedInUrl: 'https://linkedin.com/in/someone' })
		);
	});

	it.each([true, undefined])('lets the employee change their own rate when the setting is %p', async (setting) => {
		allowEmployeesToEditOwnRates = setting;

		await update(OWN_ID, { billRateValue: 30 });

		expect(create).toHaveBeenCalledWith(expect.objectContaining({ billRateValue: 30 }));
	});

	it('lets an admin change rates, their own and a colleague’s, with own rates locked', async () => {
		permissions = [PermissionsEnum.PROFILE_EDIT, PermissionsEnum.ORG_EMPLOYEES_EDIT];

		await update(OWN_ID, { billRateValue: 30 });
		await update(OTHER_ID, { reWeeklyLimit: 20 });

		expect(create).toHaveBeenCalledTimes(2);
	});

	it('lets a holder of CHANGE_SELECTED_EMPLOYEE change their own rate with own rates locked', async () => {
		permissions = [PermissionsEnum.PROFILE_EDIT, PermissionsEnum.CHANGE_SELECTED_EMPLOYEE];

		await update(OWN_ID, { billRateValue: 30 });

		expect(create).toHaveBeenCalledWith(expect.objectContaining({ billRateValue: 30 }));
	});
});
