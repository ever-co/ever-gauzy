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
 * their profile. Changing one's own rates now needs CHANGE_OWN_RATES, which SUPER_ADMIN and ADMIN hold by default: an
 * employee's profile still saves, their rates do not change, and they send a rate change request instead. Someone
 * else's rates keep needing ORG_EMPLOYEES_EDIT.
 */
describe('EmployeeUpdateHandler — an employee changing their own rates', () => {
	const OWN_ID = 'employee-own';
	const OTHER_ID = 'employee-other';

	let create: jest.Mock;
	let handler: EmployeeUpdateHandler;
	let permissions: PermissionsEnum[];

	const stored = (id: string) => ({
		id,
		billRateValue: 25,
		billRateCurrency: CurrenciesEnum.USD,
		minimumBillingRate: null,
		payPeriod: PayPeriodEnum.WEEKLY,
		reWeeklyLimit: 40,
		organization: { id: 'organization-1' }
	});

	const update = (id: string, input: IEmployeeUpdateInput) => handler.execute(new EmployeeUpdateCommand(id, input));

	beforeEach(() => {
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
	])('refuses an employee a change of their own %s, and saves nothing', async (_field, input) => {
		await expect(update(OWN_ID, input as IEmployeeUpdateInput)).rejects.toThrow(ForbiddenException);

		expect(create).not.toHaveBeenCalled();
	});

	it('saves a profile that sends the unchanged rates with it, and writes none of them back', async () => {
		await update(OWN_ID, {
			billRateValue: '25.00' as unknown as number,
			billRateCurrency: CurrenciesEnum.USD,
			minimumBillingRate: 0,
			payPeriod: PayPeriodEnum.WEEKLY,
			reWeeklyLimit: 40,
			githubUrl: 'https://github.com/someone'
		});

		expect(create).toHaveBeenCalledTimes(1);
		const [written] = create.mock.calls[0];
		expect(written).toEqual({ id: OWN_ID, githubUrl: 'https://github.com/someone' });
	});

	it('answers the stored rates after a self save that left them out of the write', async () => {
		const answer = await update(OWN_ID, { billRateValue: 25, githubUrl: 'https://github.com/someone' });

		expect(answer).toEqual(
			expect.objectContaining({
				id: OWN_ID,
				githubUrl: 'https://github.com/someone',
				billRateValue: 25,
				billRateCurrency: CurrenciesEnum.USD,
				payPeriod: PayPeriodEnum.WEEKLY,
				reWeeklyLimit: 40
			})
		);
	});

	it('saves a social links only edit', async () => {
		await update(OWN_ID, { linkedInUrl: 'https://linkedin.com/in/someone' });

		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({ linkedInUrl: 'https://linkedin.com/in/someone' })
		);
	});

	it('refuses the change when the own id is sent in another letter case', async () => {
		permissions = [PermissionsEnum.PROFILE_EDIT, PermissionsEnum.ORG_EMPLOYEES_EDIT];

		await expect(update(OWN_ID.toUpperCase(), { billRateValue: 30 })).rejects.toThrow(ForbiddenException);
		expect(create).not.toHaveBeenCalled();
	});

	it('lets a holder of CHANGE_OWN_RATES change their own rates', async () => {
		permissions = [PermissionsEnum.PROFILE_EDIT, PermissionsEnum.CHANGE_OWN_RATES];

		await update(OWN_ID, { billRateValue: 30, reWeeklyLimit: 20 });

		expect(create).toHaveBeenCalledWith(expect.objectContaining({ billRateValue: 30, reWeeklyLimit: 20 }));
	});

	it.each([
		['ORG_EMPLOYEES_EDIT', PermissionsEnum.ORG_EMPLOYEES_EDIT],
		['CHANGE_SELECTED_EMPLOYEE', PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]
	])('refuses a holder of %s alone a change of their own rate', async (_name, permission) => {
		permissions = [PermissionsEnum.PROFILE_EDIT, permission];

		await expect(update(OWN_ID, { billRateValue: 30 })).rejects.toThrow(ForbiddenException);
		expect(create).not.toHaveBeenCalled();
	});

	it("lets a holder of ORG_EMPLOYEES_EDIT change a colleague's rates without CHANGE_OWN_RATES", async () => {
		permissions = [PermissionsEnum.PROFILE_EDIT, PermissionsEnum.ORG_EMPLOYEES_EDIT];

		await update(OTHER_ID, { billRateValue: 30, reWeeklyLimit: 20 });

		expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: OTHER_ID, billRateValue: 30 }));
	});
});
