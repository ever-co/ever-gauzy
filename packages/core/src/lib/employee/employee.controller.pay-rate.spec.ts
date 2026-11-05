import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { EmployeeController } from './employee.controller';

/**
 * The generic employee lists take a caller's select, filter and sort. A filter or a sort on the pay rate would tell
 * by which employees come back, or in which order, what the rows never show, so the lists drop every pay rate key.
 * An edit of one's own record is checked for a pay rate change before it runs.
 */
describe('EmployeeController and the pay rate', () => {
	let findAll: jest.Mock;
	let pagination: jest.Mock;
	let countBy: jest.Mock;
	let assertOwnPayRateUnchanged: jest.Mock;
	let execute: jest.Mock;
	let controller: EmployeeController;

	beforeEach(() => {
		findAll = jest.fn().mockResolvedValue({ items: [], total: 0 });
		pagination = jest.fn().mockResolvedValue({ items: [], total: 0 });
		countBy = jest.fn().mockResolvedValue(0);
		assertOwnPayRateUnchanged = jest.fn().mockResolvedValue(undefined);
		execute = jest.fn().mockResolvedValue({ id: 'employee-1' });
		controller = new EmployeeController(
			{ findAll, pagination, countBy, assertOwnPayRateUnchanged } as never,
			{ execute } as never,
			{} as never,
			{} as never
		);
	});

	const payRateQuery = {
		select: { id: true, payRateValue: true, payRateCurrency: true },
		where: { organizationId: 'organization-1', payRateValue: 30, payRateCurrency: 'USD' },
		order: { payRateValue: 'DESC', billRateValue: 'ASC' }
	};

	it('drops the pay rate from the select, filter and sort of the employee list', async () => {
		await controller.findAll(payRateQuery as never);

		const [options] = findAll.mock.calls[0];
		expect(options.select).toEqual({ id: true });
		expect(options.where).toEqual(
			expect.objectContaining({ organizationId: 'organization-1', user: { isActive: true, isArchived: false } })
		);
		expect(options.where).not.toHaveProperty('payRateValue');
		expect(options.where).not.toHaveProperty('payRateCurrency');
		expect(options.order).toEqual({ billRateValue: 'ASC' });
	});

	it('drops the pay rate from the paginated list too, each branch of an either-or filter included', async () => {
		await controller.pagination({ ...payRateQuery, where: [{ payRateValue: 30 }, { payRateValue: 7 }] } as never);

		const [options] = pagination.mock.calls[0];
		expect(options.select).toEqual({ id: true });
		expect(options.where).toEqual([{}, {}]);
		expect(options.order).toEqual({ billRateValue: 'ASC' });
	});

	it('drops the pay rate from the criteria of the employee count', async () => {
		await controller.getCount({
			organizationId: 'organization-1',
			payRateValue: 30,
			payRateCurrency: 'USD'
		} as never);

		expect(countBy).toHaveBeenCalledWith({ organizationId: 'organization-1', kind: 'human' });
	});

	describe('a save of one’s own record', () => {
		let permissions: PermissionsEnum[];

		beforeEach(() => {
			permissions = [PermissionsEnum.ORG_EMPLOYEES_EDIT];
			jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue('employee-1');
			jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) =>
				permissions.includes(permission as PermissionsEnum)
			);
		});

		afterEach(() => jest.restoreAllMocks());

		it('writes no pay rate without CHANGE_OWN_RATES, though the unchanged values were sent', async () => {
			await controller.update('employee-1', { payRateValue: 30, payRateCurrency: 'USD', isAway: true } as never);

			const [command] = execute.mock.calls[0];
			expect(command.input).toEqual({ isAway: true });
		});

		it('writes no pay rate when the own id is sent in another letter case', async () => {
			await controller.update('EMPLOYEE-1', { payRateValue: 30, isAway: true } as never);

			const [command] = execute.mock.calls[0];
			expect(command.input).toEqual({ isAway: true });
		});

		it('writes the pay rate with CHANGE_OWN_RATES', async () => {
			permissions = [PermissionsEnum.ORG_EMPLOYEES_EDIT, PermissionsEnum.CHANGE_OWN_RATES];

			await controller.update('employee-1', { payRateValue: 45 } as never);

			const [command] = execute.mock.calls[0];
			expect(command.input).toEqual({ payRateValue: 45 });
		});

		it("writes a colleague's pay rate for a rate editor", async () => {
			await controller.update('employee-2', { payRateValue: 45 } as never);

			const [command] = execute.mock.calls[0];
			expect(command.input).toEqual({ payRateValue: 45 });
		});
	});

	it('checks an edit for a change of one’s own pay rate before it runs', async () => {
		assertOwnPayRateUnchanged.mockRejectedValue(new ForbiddenException());

		await expect(controller.update('employee-1', { payRateValue: 45 } as never)).rejects.toThrow(
			ForbiddenException
		);
		expect(assertOwnPayRateUnchanged).toHaveBeenCalledWith('employee-1', { payRateValue: 45 });
		expect(execute).not.toHaveBeenCalled();
	});
});
