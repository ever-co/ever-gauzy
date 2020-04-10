import {
	MonthAggregatedEmployeeStatistics,
	MonthAggregatedEmployeeStatisticsFindInput
} from '@gauzy/models';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EmployeeService } from '../../../employee/employee.service';
import { EmployeeStatisticsService } from '../../employee-statistics.service';
import { MonthAggregatedEmployeeStatisticsQuery } from '../month-aggregated-employee-statistics.query';
import { startOfMonth, subMonths } from 'date-fns';

/**
 * Finds income, expense, profit and bonus
 * for past N months of an employee a given value date.
 */
@QueryHandler(MonthAggregatedEmployeeStatisticsQuery)
export class MonthAggregatedEmployeeStatisticsQueryHandler
	implements IQueryHandler<MonthAggregatedEmployeeStatisticsQuery> {
	constructor(
		private employeeStatisticsService: EmployeeStatisticsService,
		private employeeService: EmployeeService
	) {}

	public async execute(
		command: MonthAggregatedEmployeeStatisticsQuery
	): Promise<MonthAggregatedEmployeeStatistics[]> {
		const { input } = command;

		/**
		 * Map to hold income, expense, bonus and profit statistics
		 * key formed using month-year
		 * value will be populated with statistics
		 */
		const statisticsMap: Map<
			string,
			MonthAggregatedEmployeeStatistics
		> = new Map();

		// 1. Populate Income and Direct Bonus in statisticsMap
		await this._loadEmployeeIncomeAndDirectBonus(input, statisticsMap);

		// 2. Populate Expenses(One time, Recurring, and split expenses) in statisticsMap
		await this._loadEmployeeExpenses(input, statisticsMap);
		await this._loadEmployeeRecurringExpenses(input, statisticsMap);
		await this._loadOrganizationSplitExpenses(input, statisticsMap);
		await this._loadOrganizationRecurringSplitExpenses(
			input,
			statisticsMap
		);

		// 3. Populate Profit in statisticsMap
		this._calculateProfit(statisticsMap);

		// 4. Populate Bonus in statisticsMap
		await this._loadEmployeeBonus(input, statisticsMap);

		// 5. statisticsMap values are sorted based on date in descending order
		const response = [...statisticsMap.values()].sort((a, b) =>
			a.year === b.year ? b.month - a.month : b.year - a.year
		);

		return response;
	}

	/**
	 *
	 * @param input
	 * @param statisticsMap
	 * Fetches employee's incomes for past N months from given date
	 * Updates income and bonus statistics values(in case direct bonus income) in map if key pre-exists
	 * Adds a new map entry if the key(month-year) does not already exist
	 */
	private async _loadEmployeeIncomeAndDirectBonus(
		input: MonthAggregatedEmployeeStatisticsFindInput,
		statisticsMap: Map<string, MonthAggregatedEmployeeStatistics>
	) {
		// Fetch employee's incomes for past N months from given date
		const {
			items: incomes
		} = await this.employeeStatisticsService.employeeIncomeInNMonths(
			[input.employeeId],
			input.valueDate,
			input.months
		);
		incomes.map((income) => {
			const key = `${income.valueDate.getMonth()}-${income.valueDate.getFullYear()}`;
			const amount = Number(income.amount);

			if (statisticsMap.has(key)) {
				// Update income and bonus statistics values(in case direct bonus income) in map if key pre-exists
				const stat = statisticsMap.get(key);
				stat.income = Number((stat.income + amount).toFixed(2));
				stat.bonus = income.isBonus
					? Number((stat.bonus + amount).toFixed(2))
					: stat.bonus;
			} else {
				// Add a new map entry if the key(month-year) does not already exist
				const newStat: MonthAggregatedEmployeeStatistics = {
					month: income.valueDate.getMonth(),
					year: income.valueDate.getFullYear(),
					income: Number(amount.toFixed(2)),
					expense: 0,
					profit: 0,
					bonus: income.isBonus ? Number(amount.toFixed(2)) : 0
				};
				statisticsMap.set(key, newStat);
			}
		});
	}

	/**
	 *
	 * @param input
	 * @param statisticsMap
	 * Fetches employee's expenses for past N months from given date
	 * Updates expense statistics values in map if key pre-exists
	 * Adds a new map entry if the key(month-year) does not already exist
	 */
	private async _loadEmployeeExpenses(
		input: MonthAggregatedEmployeeStatisticsFindInput,
		statisticsMap: Map<string, MonthAggregatedEmployeeStatistics>
	) {
		// Fetch employee's expenses for past N months from given date
		const {
			items: expenses
		} = await this.employeeStatisticsService.employeeExpenseInNMonths(
			[input.employeeId],
			input.valueDate,
			input.months
		);

		expenses.map((expense) => {
			const key = `${expense.valueDate.getMonth()}-${expense.valueDate.getFullYear()}`;
			const amount = Number(expense.amount);
			if (statisticsMap.has(key)) {
				// Update expense statistics values in map if key pre-exists
				const stat = statisticsMap.get(key);
				stat.expense = Number((amount + stat.expense).toFixed(2));
			} else {
				// Add a new map entry if the key(month-year) does not already exist
				const newStat: MonthAggregatedEmployeeStatistics = {
					month: expense.valueDate.getMonth(),
					year: expense.valueDate.getFullYear(),
					income: 0,
					expense: Number(amount.toFixed(2)),
					profit: 0,
					bonus: 0
				};
				statisticsMap.set(key, newStat);
			}
		});
	}

	/**
	 *
	 * @param input
	 * @param statisticsMap
	 * Fetches employee's recurring expenses
	 * Updates expense statistics values in map if key pre-exists
	 * Adds a new map entry if the key(month-year) does not already exist
	 */
	private async _loadEmployeeRecurringExpenses(
		input: MonthAggregatedEmployeeStatisticsFindInput,
		statisticsMap: Map<string, MonthAggregatedEmployeeStatistics>
	) {
		const {
			items: employeeRecurringExpenses
		} = await this.employeeStatisticsService.employeeRecurringExpenses([
			input.employeeId
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
				startOfMonth(input.valueDate),
				input.months - 1
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
				date <= input.valueDate;
				date.setMonth(date.getMonth() + 1)
			) {
				// Stop loading expense if the recurring expense has ended before input date
				if (expense.endDate && date > expense.endDate) break;

				const key = `${date.getMonth()}-${date.getFullYear()}`;
				const amount = Number(expense.value);
				if (statisticsMap.has(key)) {
					// Update expense statistics values in map if key pre-exists
					const stat = statisticsMap.get(key);
					stat.expense = Number((amount + stat.expense).toFixed(2));
				} else {
					// Add a new map entry if the key(month-year) does not already exist
					const newStat: MonthAggregatedEmployeeStatistics = {
						month: date.getMonth(),
						year: date.getFullYear(),
						income: 0,
						expense: Number(amount.toFixed(2)),
						profit: 0,
						bonus: 0
					};
					statisticsMap.set(key, newStat);
				}
			}
		});
	}

	/**
	 *
	 * @param input
	 * @param statisticsMap
	 * Fetches employee's organization expenses that were marked to be split among
	 * its employees for past N months from given date
	 * Updates expense statistics values in map if key pre-exists
	 * Adds a new map entry if the key(month-year) does not already exist
	 */
	private async _loadOrganizationSplitExpenses(
		input: MonthAggregatedEmployeeStatisticsFindInput,
		statisticsMap: Map<string, MonthAggregatedEmployeeStatistics>
	) {
		// Fetch split expenses and the number of employees the expense need to be split among
		// the split among will be different for every month, depending upon the number of active employees in the month
		const splitExpensesMap = await this.employeeStatisticsService.employeeSplitExpenseInNMonths(
			input.employeeId,
			input.valueDate,
			input.months
		);

		splitExpensesMap.forEach((value, key) => {
			if (statisticsMap.has(key)) {
				// Update expense statistics values in map if key pre-exists
				const stat = statisticsMap.get(key);
				stat.expense = Number(
					(value.splitExpense + stat.expense).toFixed(2)
				);
			} else {
				// Add a new map entry if the key(month-year) does not already exist
				const newStat: MonthAggregatedEmployeeStatistics = {
					month: value.month,
					year: value.year,
					income: 0,
					expense: Number(value.splitExpense.toFixed(2)),
					profit: 0,
					bonus: 0
				};
				statisticsMap.set(key, newStat);
			}
		});
	}

	/**
	 *
	 * @param input
	 * @param statisticsMap
	 * Fetches employee's organization recurring expenses that were marked to be split among
	 * its employees for past N months from given date
	 * Updates expense statistics values in map if key pre-exists
	 * Adds a new map entry if the key(month-year) does not already exist

	 */
	private async _loadOrganizationRecurringSplitExpenses(
		input: MonthAggregatedEmployeeStatisticsFindInput,
		statisticsMap: Map<string, MonthAggregatedEmployeeStatistics>
	) {
		const splitExpensesMap = await this.employeeStatisticsService.organizationRecurringSplitExpenses(
			input.employeeId,
			input.valueDate,
			input.months
		);

		splitExpensesMap.forEach((value, key) => {
			if (statisticsMap.has(key)) {
				// Update expense statistics values in map if key pre-exists
				const stat = statisticsMap.get(key);
				stat.expense = Number(
					(value.splitExpense + stat.expense).toFixed(2)
				);
			} else {
				// Add a new map entry if the key(month-year) does not already exist
				const newStat: MonthAggregatedEmployeeStatistics = {
					month: value.month,
					year: value.year,
					income: 0,
					expense: Number(value.splitExpense.toFixed(2)),
					profit: 0,
					bonus: 0
				};
				statisticsMap.set(key, newStat);
			}
		});
	}

	/**
	 *
	 * @param statisticsMap
	 * Profit = Income - Expense
	 * For every stat entry in the map, update profit value
	 */

	private _calculateProfit(
		statisticsMap: Map<string, MonthAggregatedEmployeeStatistics>
	) {
		// For every stat entry in the map, update profit value
		statisticsMap.forEach((stat) => {
			stat.profit = Number((stat.income - stat.expense).toFixed(2));
		});
	}

	/**
	 *
	 * @param input
	 * @param statisticsMap
	 * Fetch employee's organization bonus type and percentage
	 * For every stat entry in the map, update bonus value
	 */
	private async _loadEmployeeBonus(
		input: MonthAggregatedEmployeeStatisticsFindInput,
		statisticsMap: Map<string, MonthAggregatedEmployeeStatistics>
	) {
		const {
			organization: { bonusType, bonusPercentage }
		} = await this.employeeService.findOne(input.employeeId, {
			relations: ['organization']
		});
		statisticsMap.forEach((stat) => {
			// Get calculated bonus value for stat
			const bonus = this.employeeStatisticsService.calculateEmployeeBonus(
				bonusType,
				bonusPercentage,
				stat.income,
				stat.profit
			);
			stat.bonus = Number((stat.bonus + bonus).toFixed(2));
		});
	}
}
