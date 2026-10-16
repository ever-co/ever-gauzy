import '../core/entities/internal';

import { EmployeeStatisticsService, monthOf, shareOf } from './employee-statistics.service';

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

		// People only (`humansOnly`): an agent employee takes no share of a split expense.
		expect(employeeService.findWorkingEmployees).toHaveBeenCalledWith(
			'org-1',
			monthOf(new Date(2024, 0, 17)),
			false,
			true
		);
		expect(map.get('0-2024')).toMatchObject({ splitAmong: 4, splitExpense: 250 });
	});

	const firstQuarter = { startDate: new Date(2024, 0, 1), endDate: new Date(2024, 2, 31) };
	const firstQuarterMonths = [new Date(2024, 0, 1), new Date(2024, 1, 1), new Date(2024, 2, 1)];

	// The recurring split expenses of the first quarter of 2024, for the given recurring expenses
	const recurringSplit = async (items: object[]) => {
		const context = setup();
		context.organizationRecurringExpenseService.findAll.mockResolvedValue({ items });
		const map = await context.service.organizationRecurringSplitExpenses('employee-1', firstQuarter, 'org-1');
		return { ...context, map, valueDates: [...map.values()].map(({ valueDate }) => valueDate) };
	};

	it('dates every month of a recurring split expense in its own month', async () => {
		const { employeeService, valueDates } = await recurringSplit([
			{ startDate: new Date(2023, 5, 1), endDate: null, value: 300 }
		]);

		expect(valueDates).toEqual(firstQuarterMonths);
		expect(employeeService.findWorkingEmployees).toHaveBeenCalledWith(
			'org-1',
			monthOf(new Date(2024, 1, 1)),
			false,
			true
		);
	});

	it('keeps each month dated in its own month when several recurring expenses cover it', async () => {
		const { map, valueDates } = await recurringSplit([
			{ startDate: new Date(2023, 5, 1), endDate: null, value: 300 },
			{ startDate: new Date(2023, 8, 1), endDate: null, value: 100 }
		]);

		expect(valueDates).toEqual(firstQuarterMonths);
		expect(map.get('1-2024')).toMatchObject({ splitAmong: 4, splitExpense: 100 });
	});

	it('gives a zero share, not Infinity, for a month in which nobody was working', async () => {
		const { service, employeeService, expenseService, organizationRecurringExpenseService } = setup();
		employeeService.findWorkingEmployees.mockResolvedValue({ total: 0 });
		expenseService.findAll.mockResolvedValue({
			items: [
				{ valueDate: new Date(2024, 0, 10), amount: 1000 },
				{ valueDate: new Date(2024, 0, 20), amount: 500 }
			]
		});
		organizationRecurringExpenseService.findAll.mockResolvedValue({
			items: [
				{ startDate: new Date(2024, 0, 1), endDate: null, value: 300 },
				{ startDate: new Date(2024, 0, 1), endDate: null, value: 100 }
			]
		});
		const range = { startDate: new Date(2024, 0, 1), endDate: new Date(2024, 0, 31) };

		const oneOff = await service.employeeSplitExpenseInNMonths('employee-1', range, 'org-1');
		const recurring = await service.organizationRecurringSplitExpenses('employee-1', range, 'org-1');

		expect(oneOff.get('0-2024')).toMatchObject({ splitAmong: 0, splitExpense: 0 });
		expect(recurring.get('0-2024')).toMatchObject({ splitAmong: 0, splitExpense: 0 });
		expect(shareOf(300, 0)).toBe(0);
		expect(shareOf(300, 4)).toBe(75);
	});
});
