import {
	IAggregatedEmployeeStatistic,
	IChartEmployeeStatistic,
	IDateRangePicker,
	IEmployee,
	IEmployeeStatisticSum,
	IExpense,
	IIncome,
	IMonthAggregatedSplitExpense,
	IStatisticSum
} from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import * as moment from 'moment';
import { EmployeeService } from '../../../employee/employee.service';
import { AggregatedEmployeeStatisticQuery } from '../aggregate-employee-statistic.query';
import { EmployeeStatisticsService, monthOf, shareOf } from './../../employee-statistics.service';
import { recurringExpenseMonths, recurringExpenseStart } from '../../recurring-expense-start';

/** The employees working in each month, by `month-year` key, read once per query. */
type WorkingEmployeesByMonth = Map<string, Promise<Set<string>>>;
/** The recurring expenses counted on one day of the chart: each employee's own, and the split ones by month. */
type RecurringExpensesOfDay = {
	employees: { employeeId: string; value: number }[];
	split: Map<string, IMonthAggregatedSplitExpense>;
};

/** The dates a recurring expense is counted on in the range, as the totals count it: once a month, until it ends. */
function* recurringExpenseDates(
	expense: { startDate: Date; endDate?: Date },
	{ startDate, endDate }: IDateRangePicker
): Generator<Date> {
	for (const date of recurringExpenseMonths(recurringExpenseStart(expense.startDate, startDate), endDate)) {
		if (expense.endDate && date > expense.endDate) return;
		yield date;
	}
}

/**
 * Finds income, expense, profit and bonus for all employees for the given month.
 * If month is not specified, finds from the start of time till now.
 */
@QueryHandler(AggregatedEmployeeStatisticQuery)
export class AggregateOrganizationQueryHandler
	implements IQueryHandler<AggregatedEmployeeStatisticQuery>
{
	constructor(
		private employeeService: EmployeeService,
		private employeeStatisticsService: EmployeeStatisticsService
	) {}

	public async execute(
		command: AggregatedEmployeeStatisticQuery
	): Promise<IAggregatedEmployeeStatistic> {
		const { input } = command;
		const { organizationId, startDate, endDate } = input;
		const { items: employees } =
			await this.employeeService.findWorkingEmployees(
				organizationId,
				{
					startDate,
					endDate
				},
				true
			);
		const employeeMap: Map<string, IEmployeeStatisticSum> = new Map();

		employees.forEach((employee) => {
			employeeMap.set(employee.id, {
				income: 0,
				expense: 0,
				bonus: 0,
				profit: 0,
				employee: {
					id: employee.id,
					user: employee.user
				}
			});
		});

		const months = moment(endDate).diff(moment(startDate), 'months');
		// Calculate transactions for 1 month if filterDate is available,
		// TODO: last 20 years otherwise. More than one month can be very complex, since in any given month, any number of employees can be working
		const searchInput = {
			months,
			rangeDate: {
				startDate,
				endDate
			}
		};

		// Who worked in which month, shared by the totals and the chart below
		let workingByMonth: WorkingEmployeesByMonth = new Map();

		if (employees.length > 0) {
			await this._loadAllData(searchInput, employeeMap, organizationId, workingByMonth);
		}

		const employeeStats = [...employeeMap.values()];
		const total: IStatisticSum = employeeStats.reduce(
			this._aggregateEmployeeStats,
			{ income: 0, expense: 0, bonus: 0, profit: 0 }
		);

		return {
			total,
			employees: employeeStats,
			chart: await this._loadChartData(employees, searchInput, organizationId, workingByMonth)
		};
	}

	private async _loadChartData(
		employees: IEmployee[],
		searchInput: { rangeDate: IDateRangePicker; months: number },
		organizationId: string,
		workingByMonth: WorkingEmployeesByMonth
	): Promise<IChartEmployeeStatistic[]> {
		const { endDate, startDate } = searchInput.rangeDate;
		const PERIOD = moment(endDate).diff(moment(startDate), 'day') + 1;
		const chartStats: IChartEmployeeStatistic[] = [];
		const recurringByDay =
			employees.length > 0
				? await this._loadRecurringExpensesByDay(
						employees.map(({ id }) => id),
						searchInput.rangeDate,
						organizationId,
						PERIOD
					)
				: [];
		for (let i = 0; i < PERIOD; i++) {
			const employeeMap: Map<string, IEmployeeStatisticSum> = new Map();
			employees.forEach((employee) => {
				employeeMap.set(employee.id, {
					income: 0,
					expense: 0,
					bonus: 0,
					profit: 0,
					employee: {
						id: employee.id,
						user: employee.user
					}
				});
			});
			if (employees.length > 0) {
				await this._loadAllData(
					{
						...searchInput,
						rangeDate: {
							startDate: moment(startDate).add(i, 'day').toDate(),
							endDate: moment(startDate)
								.add(i + 1, 'day')
								.toDate()
						}
					},
					employeeMap,
					organizationId,
					workingByMonth,
					recurringByDay[i]
				);
			}
			const employeeStats = [...employeeMap.values()];
			chartStats.push({
				dates: moment(startDate).add(i, 'day').format('LL'),
				statistics: employeeStats.reduce(this._aggregateEmployeeStats, {
					income: 0,
					expense: 0,
					bonus: 0,
					profit: 0
				})
			});
		}
		return chartStats;
	}

	/**
	 * The recurring expenses counted on each day of the chart, read once for the whole range as for the totals.
	 *
	 * A recurring expense is counted once a month. Read again for each one-day window, it was counted in full on
	 * every day, so the chart's expense, profit and bonus did not add up to the totals.
	 */
	private async _loadRecurringExpensesByDay(
		employeeIds: string[],
		rangeDate: IDateRangePicker,
		organizationId: string,
		days: number
	): Promise<RecurringExpensesOfDay[]> {
		const byDay = Array.from({ length: days }, (): RecurringExpensesOfDay => ({ employees: [], split: new Map() }));
		const start = moment(rangeDate.startDate);
		const dayOf = (date: Date) => byDay[Math.min(Math.max(moment(date).diff(start, 'day'), 0), days - 1)];

		const { items: employeeRecurringExpenses } = await this.employeeStatisticsService.employeeRecurringExpenses(
			employeeIds,
			rangeDate,
			organizationId
		);
		for (const expense of employeeRecurringExpenses) {
			for (const date of recurringExpenseDates(expense, rangeDate)) {
				dayOf(date).employees.push({ employeeId: expense.employeeId, value: Number(expense.value) });
			}
		}

		// Each month's recurring split expenses, with the number of employees they are split among
		const months = await this.employeeStatisticsService.organizationRecurringSplitExpenses(
			employeeIds[0],
			rangeDate,
			organizationId
		);
		// An expense is listed under every month it is counted in: take each one once, then each of its dates
		for (const expense of new Set([...months.values()].flatMap(({ recurringExpense }) => recurringExpense))) {
			for (const date of recurringExpenseDates(expense, rangeDate)) {
				const key = `${date.getMonth()}-${date.getFullYear()}`;
				const { month, year, splitAmong } = months.get(key);
				const { split } = dayOf(date);
				const share = split.get(key) ?? { month, year, splitAmong, splitExpense: 0 };
				share.splitExpense = Number(
					(shareOf(Number(expense.value), splitAmong) + share.splitExpense).toFixed(2)
				);
				split.set(key, share);
			}
		}
		return byDay;
	}

	private async _loadAllData(
		searchInput: { rangeDate: IDateRangePicker; months: number },
		employeeMap: Map<string, IEmployeeStatisticSum>,
		organizationId: string,
		workingByMonth: WorkingEmployeesByMonth,
		recurringExpensesOfDay?: RecurringExpensesOfDay
	) {
		// 1.Load Income and Direct Bonus in employeeMap
		await this._loadIncomeAndDirectBonus(
			searchInput,
			employeeMap,
			organizationId
		);

		// 2. Populate Expenses(One time, Recurring, and split expenses) in employeeMap
		await this._loadEmployeeExpenses(
			searchInput,
			employeeMap,
			organizationId
		);

		/**
		 * Load Recurring/Split Expenses for organization/employees
		 */
		if (recurringExpensesOfDay) {
			// A day of the chart: the recurring expenses counted on that day, read once for the whole range
			for (const { employeeId, value } of recurringExpensesOfDay.employees) {
				const stat = employeeMap.get(employeeId);
				stat.expense = Number((value + stat.expense).toFixed(2));
			}
			await this._loadOrganizationSplitExpenses(searchInput, employeeMap, organizationId, workingByMonth);
			await this._addSplitShares(recurringExpensesOfDay.split, employeeMap, organizationId, workingByMonth);
		} else {
			await this._loadEmployeeRecurringExpenses(searchInput, employeeMap, organizationId);
			await this._loadOrganizationSplitExpenses(searchInput, employeeMap, organizationId, workingByMonth);
			await this._loadOrganizationRecurringSplitExpenses(
				searchInput,
				employeeMap,
				organizationId,
				workingByMonth
			);
		}

		// 3. Populate Profit in employeeMap
		this._calculateProfit(employeeMap);

		// 4. Populate Bonus in employeeMap
		await this._loadEmployeeBonus(employeeMap);
	}

	private async _loadIncomeAndDirectBonus(
		searchInput: { rangeDate: IDateRangePicker; months: number },
		employeeMap: Map<string, IEmployeeStatisticSum>,
		organizationId: string
	) {
		// Fetch employees' incomes for past N months from given date
		const { items: incomes } =
			await this.employeeStatisticsService.employeeIncomeInNMonths(
				[...employeeMap.keys()],
				searchInput.rangeDate,
				organizationId
			);
		incomes.forEach((income: IIncome) => {
			const stat = employeeMap.get(income.employeeId);
			const amount = Number(income.amount);
			stat.income = Number((stat.income + amount).toFixed(2));
			stat.bonus = income.isBonus
				? Number((stat.bonus + amount).toFixed(2))
				: stat.bonus;
		});
	}

	private async _loadEmployeeExpenses(
		searchInput: { rangeDate: IDateRangePicker; months: number },
		employeeMap: Map<string, IEmployeeStatisticSum>,
		organizationId: string
	) {
		// Fetch employees' expenses for past N months from given date
		const { items: expenses } =
			await this.employeeStatisticsService.employeeExpenseInNMonths(
				[...employeeMap.keys()],
				searchInput.rangeDate,
				organizationId
			);
		expenses.forEach((expense: IExpense) => {
			const stat = employeeMap.get(expense.employeeId);
			const amount = Number(expense.amount);
			stat.expense = Number((amount + stat.expense).toFixed(2));
		});
	}

	private async _loadEmployeeRecurringExpenses(
		searchInput: { rangeDate: IDateRangePicker; months: number },
		employeeMap: Map<string, IEmployeeStatisticSum>,
		organizationId: string
	) {
		// Fetch employees' recurring expenses for past N months from given date
		const { items: employeeRecurringExpenses } =
			await this.employeeStatisticsService.employeeRecurringExpenses(
				[...employeeMap.keys()],
				searchInput.rangeDate,
				organizationId
			);

		const { startDate, endDate } = searchInput.rangeDate;
		/**
		 * Add recurring expense from the
		 * expense start date
		 * OR
		 * past N months to each month's expense, whichever is lesser
		 * Stop adding recurring expenses at the month where it was stopped
		 * OR
		 * till the input date
		 */
		employeeRecurringExpenses.forEach((expense) => {
			// Find start date based on input date and X months.
			const inputStartDate = startDate;
			/**
			 * Add recurring expense from the
			 * expense start date
			 * OR
			 * past N months to each month's expense, whichever is more recent
			 */
			const requiredStartDate = recurringExpenseStart(expense.startDate, inputStartDate);

			for (const date of recurringExpenseMonths(requiredStartDate, endDate)) {
				// Stop loading expense if the recurring expense has ended before input date
				if (expense.endDate && date > expense.endDate) break;

				const amount = Number(expense.value);
				const stat = employeeMap.get(expense.employeeId);
				stat.expense = Number((amount + stat.expense).toFixed(2));
			}
		});
	}

	private async _loadOrganizationSplitExpenses(
		searchInput: { rangeDate: IDateRangePicker; months: number },
		employeeMap: Map<string, IEmployeeStatisticSum>,
		organizationId: string,
		workingByMonth: WorkingEmployeesByMonth
	) {
		const employeeIds = [...employeeMap.keys()];

		// Split expenses of the range, per month, with the number of employees each month's are split among
		const expenses = await this.employeeStatisticsService.employeeSplitExpenseInNMonths(
			employeeIds[0], // split expenses are fetched at organization level, 1st Employee
			searchInput.rangeDate,
			organizationId
		);

		await this._addSplitShares(expenses, employeeMap, organizationId, workingByMonth);
	}

	private async _loadOrganizationRecurringSplitExpenses(
		searchInput: { rangeDate: IDateRangePicker; months: number },
		employeeMap: Map<string, IEmployeeStatisticSum>,
		organizationId: string,
		workingByMonth: WorkingEmployeesByMonth
	) {
		const employeeIds = [...employeeMap.keys()];

		// Recurring split expenses of the range, per month, with the number of employees they are split among
		const organizationRecurringSplitExpenses =
			await this.employeeStatisticsService.organizationRecurringSplitExpenses(
				employeeIds[0],
				searchInput.rangeDate,
				organizationId
			);

		await this._addSplitShares(organizationRecurringSplitExpenses, employeeMap, organizationId, workingByMonth);
	}

	/**
	 * Adds each month's split-expense share to the employees who worked in that month.
	 *
	 * A month's expenses are divided among the employees working in it (`employeeSplitExpenseInNMonths` /
	 * `organizationRecurringSplitExpenses` count them with `findWorkingEmployees(monthOf(month))`), so exactly those
	 * employees receive the share and the shares add back up to the expense. This used to take only the first month
	 * of the range and add its share to every employee listed for the range: the later months' split expenses were
	 * never counted, and over a range in which someone joined or left, the first month's were over- or under-counted.
	 */
	private async _addSplitShares(
		months: Map<string, IMonthAggregatedSplitExpense>,
		employeeMap: Map<string, IEmployeeStatisticSum>,
		organizationId: string,
		workingByMonth: WorkingEmployeesByMonth
	): Promise<void> {
		for (const [key, month] of months) {
			if (!workingByMonth.has(key)) {
				workingByMonth.set(
					key,
					this.employeeService
						.findWorkingEmployees(organizationId, monthOf(new Date(month.year, month.month, 1)))
						.then((result) => {
							// `findWorkingEmployees` answers undefined when its query fails: that is not "nobody
							// worked", and reading it so would drop the month's split expenses from a successful answer
							if (!result) {
								throw new Error(`Could not read the employees working in ${key}`);
							}
							return new Set(result.items.map(({ id }) => id));
						})
				);
			}
			const working = await workingByMonth.get(key);
			employeeMap.forEach((emp, employeeId) => {
				if (working.has(employeeId)) {
					emp.expense = Number((emp.expense + month.splitExpense).toFixed(2));
				}
			});
		}
	}

	private _calculateProfit(employeeMap: Map<string, IEmployeeStatisticSum>) {
		employeeMap.forEach((emp) => {
			emp.profit = Number((emp.income - emp.expense).toFixed(2));
		});
	}

	private async _loadEmployeeBonus(
		employeeMap: Map<string, IEmployeeStatisticSum>
	) {
		const employeeIds = [...employeeMap.keys()];
		const {
			organization: { bonusType, bonusPercentage }
		} = await this.employeeService.findOneByIdString(employeeIds[0], {
			relations: ['organization']
		});

		employeeMap.forEach((emp) => {
			const bonus = this.employeeStatisticsService.calculateEmployeeBonus(
				bonusType,
				bonusPercentage,
				emp.income,
				emp.profit
			);
			emp.bonus = Number((emp.bonus + bonus).toFixed(2));
		});
	}

	private _aggregateEmployeeStats(
		accumulator: IStatisticSum,
		value: IStatisticSum
	): IStatisticSum {
		accumulator.income = Number(
			(accumulator.income + value.income).toFixed(2)
		);
		accumulator.expense = Number(
			(accumulator.expense + value.expense).toFixed(2)
		);
		accumulator.profit = Number(
			(accumulator.profit + value.profit).toFixed(2)
		);
		accumulator.bonus = Number(
			(accumulator.bonus + value.bonus).toFixed(2)
		);
		return accumulator;
	}
}
