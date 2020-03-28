import {
	AggregatedEmployeeStatistic,
	EmployeeStatisticSum,
	StatisticSum
} from '@gauzy/models';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { startOfMonth, subMonths } from 'date-fns';
import { EmployeeService } from '../../../employee/employee.service';
import { AggregatedEmployeeStatisticQuery } from '../aggregate-employee-statistic.query';
import { EmployeeStatisticsService } from './../../employee-statistics.service';

/**
 * Finds income, expense, profit and bonus for all employees for the given month.
 * If month is not specified, finds from the start of time till now.
 */
@QueryHandler(AggregatedEmployeeStatisticQuery)
export class AggregateOrganizationQueryHandler
	implements IQueryHandler<AggregatedEmployeeStatisticQuery> {
	constructor(
		private employeeService: EmployeeService,
		private employeeStatisticsService: EmployeeStatisticsService
	) {}

	public async execute(
		command: AggregatedEmployeeStatisticQuery
	): Promise<AggregatedEmployeeStatistic> {
		const {
			input: { filterDate, organizationId }
		} = command;

		// Calculate transactions for 1 month if filterDate is available, last 20 years otherwise.
		const searchInput = {
			months: filterDate ? 1 : 12 * 20,
			valueDate: filterDate ? filterDate : new Date()
		};

		// Get employees of input organization
		const { items: employees } = await this.employeeService.findAll({
			select: ['id'],
			where: {
				organization: {
					id: organizationId
				}
			},
			relations: ['user']
		});

		const employeeMap: Map<string, EmployeeStatisticSum> = new Map();

		employees.map((employee) => {
			// Hide user hash
			employee.user.hash = '';
			employeeMap.set(employee.id, {
				income: 0,
				expense: 0,
				bonus: 0,
				profit: 0,
				employee
			});
		});

		// 1.Load Income and Direct Bonus in employeeMap
		await this._loadIncomeAndDirectBonus(searchInput, employeeMap);

		// 2. Populate Expenses(One time, Recurring, and split expenses) in employeeMap
		await this._loadEmployeeExpenses(searchInput, employeeMap);
		await this._loadEmployeeRecurringExpenses(searchInput, employeeMap);
		await this._loadOrganizationSplitExpenses(searchInput, employeeMap);
		await this._loadOrganizationRecurringSplitExpenses(
			searchInput,
			employeeMap
		);

		// 3. Populate Profit in employeeMap
		this._calculateProfit(employeeMap);

		// 4. Populate Bonus in employeeMap
		await this._loadEmployeeBonus(employeeMap);

		const employeeStats = [...employeeMap.values()];
		const total: StatisticSum = employeeStats.reduce(
			this._aggregateEmployeeStats,
			{ income: 0, expense: 0, bonus: 0, profit: 0 }
		);

		return {
			total,
			employees: employeeStats
		};
	}

	private async _loadIncomeAndDirectBonus(
		searchInput: { valueDate: Date; months: number },
		employeeMap: Map<string, EmployeeStatisticSum>
	) {
		// Fetch employees' incomes for past N months from given date
		const {
			items: incomes
		} = await this.employeeStatisticsService.employeeIncomeInNMonths(
			[...employeeMap.keys()],
			searchInput.valueDate,
			searchInput.months
		);

		incomes.map((income) => {
			const stat = employeeMap.get(income.employeeId);
			const amount = Number(income.amount);
			stat.income = Number((stat.income + amount).toFixed(2));
			stat.bonus = income.isBonus
				? Number((stat.bonus + amount).toFixed(2))
				: stat.bonus;
		});
	}

	private async _loadEmployeeExpenses(
		searchInput: { valueDate: Date; months: number },
		employeeMap: Map<string, EmployeeStatisticSum>
	) {
		// Fetch employees' expenses for past N months from given date
		const {
			items: expenses
		} = await this.employeeStatisticsService.employeeExpenseInNMonths(
			[...employeeMap.keys()],
			searchInput.valueDate,
			searchInput.months
		);
		expenses.map((expense) => {
			const stat = employeeMap.get(expense.employeeId);
			const amount = Number(expense.amount);
			stat.expense = Number((amount + stat.expense).toFixed(2));
		});
	}

	private async _loadEmployeeRecurringExpenses(
		searchInput: { valueDate: Date; months: number },
		employeeMap: Map<string, EmployeeStatisticSum>
	) {
		// Fetch employees' recurring expenses for past N months from given date
		const {
			items: employeeRecurringExpenses
		} = await this.employeeStatisticsService.employeeRecurringExpenses([
			...employeeMap.keys()
		]);

		/**
		 * Add recurring expense from the
		 * expense start date
		 * OR
		 * past N months to each month's expense, whichever is lesser
		 * Stop adding recurring expenses at the month where it was stopped
		 * OR
		 * till the input date
		 */
		employeeRecurringExpenses.map((expense) => {
			// Find start date based on input date and X months.
			const inputStartDate = subMonths(
				startOfMonth(searchInput.valueDate),
				searchInput.months - 1
			);

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
				const date = requiredStartDate;
				date <= searchInput.valueDate;
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
		searchInput: { valueDate: Date; months: number },
		employeeMap: Map<string, EmployeeStatisticSum>
	) {
		const employeeIds = [...employeeMap.keys()] || [''];

		// Fetch split expenses and the number of employees the expense need to be split among
		const {
			items: expenses,
			splitAmong
		} = await this.employeeStatisticsService.employeeSplitExpenseInNMonths(
			employeeIds[0], // split expenses are fetched at organization level, 1st Employee
			searchInput.valueDate,
			searchInput.months
		);

		// sum all split expenses amounts
		const commonSplitAmount = expenses.reduce((a, b) => a + b.amount, 0);

		// Add split expense share to each employee's expenses
		employeeMap.forEach((emp) => {
			emp.expense = Number(
				(emp.expense + commonSplitAmount / splitAmong).toFixed(2)
			);
		});
	}

	private async _loadOrganizationRecurringSplitExpenses(
		searchInput: { valueDate: Date; months: number },
		employeeMap: Map<string, EmployeeStatisticSum>
	) {
		const employeeIds = [...employeeMap.keys()] || [''];

		// Fetch split expenses and the number of employees the expense need to be split among
		const {
			items: organizationRecurringSplitExpenses,
			splitAmong
		} = await this.employeeStatisticsService.organizationRecurringSplitExpenses(
			employeeIds[0]
		);

		/**
		 * Add Organization split recurring expense from the
		 * expense start date
		 * OR
		 * past N months to each month's expense, whichever is lesser
		 * Stop adding recurring expenses at the month where it was stopped
		 * OR
		 * till the input date
		 */
		const splitExpenses = organizationRecurringSplitExpenses.map(
			(expense) => {
				// Find start date based on input date and X months.
				const inputStartDate = subMonths(
					startOfMonth(searchInput.valueDate),
					searchInput.months - 1
				);

				/**
				 * Add Organization split recurring expense from the
				 * expense start date
				 * OR
				 * past N months to each month's expense, whichever is more recent
				 */
				const requiredStartDate =
					expense.startDate > inputStartDate
						? expense.startDate
						: inputStartDate;

				let amount = 0;
				for (
					const date = requiredStartDate;
					date <= searchInput.valueDate;
					date.setMonth(date.getMonth() + 1)
				) {
					// Stop loading expense if the split recurring expense has ended before input date
					if (expense.endDate && date > expense.endDate) break;

					// accumulate employee's recurring expense share for each month
					amount += Number(expense.value) / splitAmong;
				}
				return amount;
			}
		);

		// sum accumulate employee's recurring expense shares
		const employeeShare = splitExpenses.reduce((a, b) => a + b, 0);
		employeeMap.forEach(
			(emp) =>
				(emp.expense = Number((emp.expense + employeeShare).toFixed(2)))
		);
	}

	private _calculateProfit(employeeMap: Map<string, EmployeeStatisticSum>) {
		employeeMap.forEach((emp) => {
			emp.profit = Number((emp.income - emp.expense).toFixed(2));
		});
	}

	private async _loadEmployeeBonus(
		employeeMap: Map<string, EmployeeStatisticSum>
	) {
		const employeeIds = [...employeeMap.keys()] || [''];
		const {
			organization: { bonusType, bonusPercentage }
		} = await this.employeeService.findOne(employeeIds[0], {
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
		accumulator: StatisticSum,
		value: StatisticSum
	): StatisticSum {
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
