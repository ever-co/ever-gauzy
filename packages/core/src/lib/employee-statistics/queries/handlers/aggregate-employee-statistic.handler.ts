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
import { EmployeeStatisticsService, monthOf } from './../../employee-statistics.service';

/** The employees working in each month, by `month-year` key, read once per query. */
type WorkingEmployeesByMonth = Map<string, Promise<Set<string>>>;
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
					workingByMonth
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

	private async _loadAllData(
		searchInput: { rangeDate: IDateRangePicker; months: number },
		employeeMap: Map<string, IEmployeeStatisticSum>,
		organizationId: string,
		workingByMonth: WorkingEmployeesByMonth
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
		await this._loadEmployeeRecurringExpenses(
			searchInput,
			employeeMap,
			organizationId
		);
		await this._loadOrganizationSplitExpenses(searchInput, employeeMap, organizationId, workingByMonth);
		await this._loadOrganizationRecurringSplitExpenses(searchInput, employeeMap, organizationId, workingByMonth);

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
			const requiredStartDate =
				expense.startDate > inputStartDate
					? expense.startDate
					: inputStartDate;

			for (
				const date = new Date(requiredStartDate);
				date <= new Date(endDate);
				date.setMonth(date.getMonth() + 1)
			) {
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
