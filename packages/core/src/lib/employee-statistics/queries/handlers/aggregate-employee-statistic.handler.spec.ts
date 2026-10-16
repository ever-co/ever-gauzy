import '../../../core/entities/internal';

import { IEmployeeStatisticSum, IMonthAggregatedSplitExpense } from '@gauzy/contracts';
import { monthOf, shareOf } from '../../employee-statistics.service';
import { recurringExpenseMonths, recurringExpenseStart } from '../../recurring-expense-start';
import { AggregateOrganizationQueryHandler } from './aggregate-employee-statistic.handler';

/**
 * The organization's split expenses in the aggregated employee statistics (accounting dashboard).
 *
 * Each month's split expenses are divided among the employees working in that month. The handler took only the
 * first month of the range and added its share to every employee listed for the range: over January–February with
 * A and B in January and C joining in February, January's $1,000 became $500 for each of the three ($1,500), and
 * February's expenses were not counted at all.
 */
describe('AggregateOrganizationQueryHandler split expenses', () => {
	const january = new Date(2024, 0, 1);
	const february = new Date(2024, 1, 1);
	const months = (): Map<string, IMonthAggregatedSplitExpense> =>
		new Map([
			['0-2024', { month: 0, year: 2024, splitExpense: 500, splitAmong: 2 } as IMonthAggregatedSplitExpense], // $1,000 / 2
			['1-2024', { month: 1, year: 2024, splitExpense: 300, splitAmong: 3 } as IMonthAggregatedSplitExpense] // $900 / 3
		]);

	const setup = () => {
		// A and B work in January; C joins in February
		const workingIn = (range: { startDate: Date }) =>
			range.startDate.getMonth() === 0 ? ['A', 'B'] : ['A', 'B', 'C'];
		const employeeService = {
			findWorkingEmployees: jest.fn(async (_organizationId: string, range: { startDate: Date }) => {
				const items = workingIn(range).map((id) => ({ id }));
				return { items, total: items.length };
			})
		};
		const employeeStatisticsService = {
			employeeSplitExpenseInNMonths: jest.fn(async () => months()),
			organizationRecurringSplitExpenses: jest.fn(async () => months())
		};
		const handler = new AggregateOrganizationQueryHandler(
			employeeService as never,
			employeeStatisticsService as never
		) as any;
		// Everyone listed for the range (January–February)
		const employeeMap = new Map<string, IEmployeeStatisticSum>(
			['A', 'B', 'C'].map((id) => [id, { income: 0, expense: 0, bonus: 0, profit: 0, employee: { id } } as never])
		);
		const searchInput = { months: 1, rangeDate: { startDate: january, endDate: new Date(2024, 1, 29) } };
		return { handler, employeeService, employeeMap, searchInput };
	};

	const expenses = (employeeMap: Map<string, IEmployeeStatisticSum>) =>
		Object.fromEntries([...employeeMap].map(([id, { expense }]) => [id, expense]));

	it("gives each month's one-off split share to that month's employees only, for every month of the range", async () => {
		const { handler, employeeService, employeeMap, searchInput } = setup();

		await handler._loadOrganizationSplitExpenses(searchInput, employeeMap, 'org-1', new Map());

		// January: A and B $500 each; February: A, B and C $300 each — the shares add back up to $1,000 + $900
		expect(expenses(employeeMap)).toEqual({ A: 800, B: 800, C: 300 });
		expect(employeeService.findWorkingEmployees).toHaveBeenCalledWith('org-1', monthOf(january));
		expect(employeeService.findWorkingEmployees).toHaveBeenCalledWith('org-1', monthOf(february));
	});

	it('does the same for the recurring split expenses, reading each month’s employees once per query', async () => {
		const { handler, employeeService, employeeMap, searchInput } = setup();
		let workingByMonth = new Map();

		await handler._loadOrganizationSplitExpenses(searchInput, employeeMap, 'org-1', workingByMonth);
		await handler._loadOrganizationRecurringSplitExpenses(searchInput, employeeMap, 'org-1', workingByMonth);

		expect(expenses(employeeMap)).toEqual({ A: 1600, B: 1600, C: 600 });
		expect(employeeService.findWorkingEmployees).toHaveBeenCalledTimes(2);
	});

	it("fails the query when a month's employees cannot be read, instead of dropping its split expenses", async () => {
		const { handler, employeeService, employeeMap, searchInput } = setup();
		// What `findWorkingEmployees` answers when its query fails
		employeeService.findWorkingEmployees.mockResolvedValueOnce(undefined as never);

		await expect(
			handler._loadOrganizationSplitExpenses(searchInput, employeeMap, 'org-1', new Map())
		).rejects.toThrow('Could not read the employees working in 0-2024');
	});
});

/**
 * #10748: the cash flow chart read the recurring expenses again for each one-day window, so each one was
 * counted in full on every day of the range (a 3,000 monthly salary showed as 3,000 on each of October's
 * 31 days). The chart now reads them once for the range and plots each monthly occurrence on the day the
 * totals count it, so the days add back up to the totals.
 */
describe('AggregateOrganizationQueryHandler cash flow chart', () => {
	const ORG = 'org-1';
	// From January 10 to February 20: counted on January 10 and February 10
	const salary = { employeeId: 'A', value: 3000, startDate: new Date(2024, 0, 10), endDate: new Date(2024, 1, 20) };
	// Open-ended rent split between A and B, started before the range: counted on the 1st of each month
	const rent = { value: 1000, categoryName: 'Rent', startDate: new Date(2023, 11, 15), endDate: null as Date | null };

	const setup = () => {
		const employeeService = {
			findWorkingEmployees: jest.fn(async () => ({ items: [{ id: 'A' }, { id: 'B' }], total: 2 })),
			findOneByIdString: jest.fn(async () => ({ organization: { bonusType: null, bonusPercentage: 0 } }))
		};
		// The reads answer what the database would for the range they are given
		const employeeStatisticsService = {
			employeeIncomeInNMonths: jest.fn(async () => ({ items: [] })),
			employeeExpenseInNMonths: jest.fn(async () => ({ items: [] })),
			employeeSplitExpenseInNMonths: jest.fn(async () => new Map()),
			employeeRecurringExpenses: jest.fn(async (_ids: string[], { startDate, endDate }) => ({
				items: [salary].filter(
					(expense) =>
						expense.startDate <= new Date(endDate) &&
						(!expense.endDate || expense.endDate >= new Date(startDate))
				)
			})),
			organizationRecurringSplitExpenses: jest.fn(async (_id: string, { startDate, endDate }) => {
				const months = new Map<string, IMonthAggregatedSplitExpense>();
				for (const date of recurringExpenseMonths(recurringExpenseStart(rent.startDate, startDate), endDate)) {
					if (rent.endDate && date > rent.endDate) break;
					const key = `${date.getMonth()}-${date.getFullYear()}`;
					months.set(key, {
						month: date.getMonth(),
						year: date.getFullYear(),
						splitAmong: 2,
						splitExpense: shareOf(rent.value, 2),
						recurringExpense: [rent],
						valueDate: date
					} as never);
				}
				return months;
			}),
			calculateEmployeeBonus: jest.fn(() => 0)
		};
		const handler = new AggregateOrganizationQueryHandler(
			employeeService as never,
			employeeStatisticsService as never
		) as any;
		return { handler, employeeStatisticsService };
	};

	const employees = [{ id: 'A' }, { id: 'B' }];
	const range = { startDate: new Date(2024, 0, 1), endDate: new Date(2024, 2, 31) };
	const searchInput = { months: 2, rangeDate: range };

	/** The chart's expense on each day, by day index, for the days that have one. */
	async function chartExpenses() {
		const { handler, employeeStatisticsService } = setup();
		const chart = await handler._loadChartData(employees, searchInput, ORG, new Map());
		const byDay = Object.fromEntries(
			chart.map(({ statistics }, day) => [day, statistics.expense]).filter(([, expense]) => expense !== 0)
		);
		return { chart, byDay, employeeStatisticsService };
	}

	it('plots each monthly occurrence once, on the day it is counted', async () => {
		const { chart, byDay } = await chartExpenses();

		expect(chart).toHaveLength(91);
		expect(byDay).toEqual({
			0: 1000, // January 1: rent
			9: 3000, // January 10: salary
			31: 1000, // February 1: rent
			40: 3000, // February 10: salary, its last occurrence
			60: 1000 // March 1: rent
		});
	});

	it('adds up to the totals of the same range', async () => {
		const { chart } = await chartExpenses();
		const { handler } = setup();
		const totals = new Map(
			employees.map(({ id }) => [id, { income: 0, expense: 0, bonus: 0, profit: 0, employee: { id } } as never])
		);
		await handler._loadAllData(searchInput, totals, ORG, new Map());

		const chartExpense = chart.reduce((sum, { statistics }) => sum + statistics.expense, 0);
		const totalExpense = [...totals.values()].reduce((sum: number, { expense }: any) => sum + expense, 0);
		expect(chartExpense).toBe(9000);
		expect(chartExpense).toBe(totalExpense);
	});

	it('reads the recurring expenses once for the whole range', async () => {
		const { employeeStatisticsService } = await chartExpenses();

		expect(employeeStatisticsService.employeeRecurringExpenses).toHaveBeenCalledTimes(1);
		expect(employeeStatisticsService.employeeRecurringExpenses).toHaveBeenCalledWith(['A', 'B'], range, ORG);
		expect(employeeStatisticsService.organizationRecurringSplitExpenses).toHaveBeenCalledTimes(1);
	});
});
