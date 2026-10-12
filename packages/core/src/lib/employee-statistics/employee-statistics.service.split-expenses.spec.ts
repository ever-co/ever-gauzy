import '../core/entities/internal';

import { EmployeeStatisticsService, monthOf } from './employee-statistics.service';

/**
 * Organization split expenses are divided among the employees working in the expense's month. The service
 * passed a bare Date to `findWorkingEmployees`, whose working-period filter needs a `{ startDate, endDate }`
 * range, so every current employee was counted. The recurring variant also stored the loop's own Date in
 * every month's entry, so they all ended up dated the month after the range.
 */
describe('EmployeeStatisticsService split expenses', () => {
	const employee = { organization: { id: 'org-1' } };

	const setup = () => {
		const employeeService = {
			findOneByOptions: jest.fn().mockResolvedValue(employee),
			findWorkingEmployees: jest.fn().mockResolvedValue({ total: 4 })
		};
		const expenseService = { findAll: jest.fn() };
		const organizationRecurringExpenseService = { findAll: jest.fn() };
		const service = new EmployeeStatisticsService(
			{} as never,
			expenseService as never,
			{} as never,
			employeeService as never,
			organizationRecurringExpenseService as never
		);
		return { service, employeeService, expenseService, organizationRecurringExpenseService };
	};

	it('monthOf spans the whole month of the date', () => {
		const { startDate, endDate } = monthOf(new Date(2024, 0, 17, 12));
		expect(startDate).toEqual(new Date(2024, 0, 1));
		expect(endDate).toEqual(new Date(2024, 0, 31, 23, 59, 59, 999));
	});

	it('splits a one-off expense among the employees working in its month', async () => {
		const { service, employeeService, expenseService } = setup();
		expenseService.findAll.mockResolvedValue({
			items: [{ valueDate: new Date(2024, 0, 17), amount: 1000 }]
		});

		const map = await service.employeeSplitExpenseInNMonths(
			'employee-1',
			{ startDate: new Date(2024, 0, 1), endDate: new Date(2024, 0, 31) },
			'org-1'
		);

		expect(employeeService.findWorkingEmployees).toHaveBeenCalledWith('org-1', monthOf(new Date(2024, 0, 17)));
		expect(map.get('0-2024')).toMatchObject({ splitAmong: 4, splitExpense: 250 });
	});

	it('dates every month of a recurring split expense in its own month', async () => {
		const { service, employeeService, organizationRecurringExpenseService } = setup();
		organizationRecurringExpenseService.findAll.mockResolvedValue({
			items: [{ startDate: new Date(2023, 5, 1), endDate: null, value: 300 }]
		});

		const map = await service.organizationRecurringSplitExpenses(
			'employee-1',
			{ startDate: new Date(2024, 0, 1), endDate: new Date(2024, 2, 31) },
			'org-1'
		);

		expect([...map.values()].map(({ valueDate }) => valueDate)).toEqual([
			new Date(2024, 0, 1),
			new Date(2024, 1, 1),
			new Date(2024, 2, 1)
		]);
		expect(employeeService.findWorkingEmployees).toHaveBeenCalledWith('org-1', monthOf(new Date(2024, 1, 1)));
	});
});
