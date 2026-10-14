import '../../../core/entities/internal';

import { IEmployeeStatisticSum, IMonthAggregatedSplitExpense } from '@gauzy/contracts';
import { monthOf } from '../../employee-statistics.service';
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
