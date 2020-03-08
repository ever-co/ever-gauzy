import {
	MonthAggregatedEmployeeStatistics,
	MonthAggregatedEmployeeStatisticsFindInput
} from '@gauzy/models';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EmployeeService } from '../../../employee/employee.service';
import { EmployeeStatisticsService } from '../../employee-statistics.service';
import { MonthAggregatedEmployeeStatisticsQuery } from '../month-aggregated-employee-statistics.query';
import { startOfMonth, subMonths } from 'date-fns';

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

		const statisticsMap: Map<
			string,
			MonthAggregatedEmployeeStatistics
		> = new Map();

		// Income and Direct Bonus
		await this._loadEmployeeIncomeAndDirectBonus(input, statisticsMap);

		// Expenses
		await this._loadEmployeeExpenses(input, statisticsMap);
		await this._loadEmployeeRecurringExpenses(input, statisticsMap);
		await this._loadEmployeeSplitExpenses(input, statisticsMap);

		// Profit
		this._calculateProfit(statisticsMap);

		// Bonus
		await this._loadEmployeeBonus(input, statisticsMap);

		// Sort stats by recent first
		const response = [...statisticsMap.values()].sort((a, b) =>
			a.year === b.year ? b.month - a.month : b.year - a.year
		);

		return response;
	}

	private async _loadEmployeeIncomeAndDirectBonus(
		input: MonthAggregatedEmployeeStatisticsFindInput,
		statisticsMap: Map<string, MonthAggregatedEmployeeStatistics>
	) {
		const {
			items: incomes
		} = await this.employeeStatisticsService.employeeIncomeInNMonths(
			input.employeeId,
			input.valueDate,
			input.months
		);
		incomes.map((income) => {
			const key = `${income.valueDate.getMonth()}-${income.valueDate.getFullYear()}`;
			const amount = Number(income.amount);

			if (statisticsMap.has(key)) {
				const stat = statisticsMap.get(key);
				stat.income = Number((stat.income + amount).toFixed(2));
				stat.bonus = income.isBonus
					? Number((stat.bonus + amount).toFixed(2))
					: stat.bonus;
			} else {
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

	private async _loadEmployeeExpenses(
		input: MonthAggregatedEmployeeStatisticsFindInput,
		statisticsMap: Map<string, MonthAggregatedEmployeeStatistics>
	) {
		const {
			items: expenses
		} = await this.employeeStatisticsService.employeeExpenseInNMonths(
			input.employeeId,
			input.valueDate,
			input.months
		);

		expenses.map((expense) => {
			const key = `${expense.valueDate.getMonth()}-${expense.valueDate.getFullYear()}`;
			const amount = Number(expense.amount);
			if (statisticsMap.has(key)) {
				const stat = statisticsMap.get(key);
				stat.expense = Number((amount + stat.expense).toFixed(2));
			} else {
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

	private async _loadEmployeeRecurringExpenses(
		input: MonthAggregatedEmployeeStatisticsFindInput,
		statisticsMap: Map<string, MonthAggregatedEmployeeStatistics>
	) {
		const {
			items: employeeRecurringExpenses
		} = await this.employeeStatisticsService.employeeRecurringExpenseInNMonths(
			input.employeeId
		);
		employeeRecurringExpenses.map((expense) => {
			/*
			 * Add recurring expense from the its start date to each month's expense
			 * Stop adding recurring expenses at the month where it was stopped or till the input date
			 */
			const inputStartDate = subMonths(
				startOfMonth(input.valueDate),
				input.months - 1
			);

			// If recurring expense started before input date minus N months, start from input date minus N months
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
					const stat = statisticsMap.get(key);
					stat.expense += Number(amount.toFixed(2));
				} else {
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

	private async _loadEmployeeSplitExpenses(
		input: MonthAggregatedEmployeeStatisticsFindInput,
		statisticsMap: Map<string, MonthAggregatedEmployeeStatistics>
	) {
		const {
			items: expenses,
			splitAmong
		} = await this.employeeStatisticsService.employeeSplitExpenseInNMonths(
			input.employeeId,
			input.valueDate,
			input.months
		);

		expenses.map((expense) => {
			const key = `${expense.valueDate.getMonth()}-${expense.valueDate.getFullYear()}`;
			const amount = expense.amount;
			if (statisticsMap.has(key)) {
				const stat = statisticsMap.get(key);
				stat.expense += Number((amount / splitAmong).toFixed(2));
			} else {
				const newStat: MonthAggregatedEmployeeStatistics = {
					month: expense.valueDate.getMonth(),
					year: expense.valueDate.getFullYear(),
					income: 0,
					expense: Number((amount / splitAmong).toFixed(2)),
					profit: 0,
					bonus: 0
				};
				statisticsMap.set(key, newStat);
			}
		});
	}

	private _calculateProfit(
		statisticsMap: Map<string, MonthAggregatedEmployeeStatistics>
	) {
		statisticsMap.forEach((stat) => {
			stat.profit = Number((stat.income - stat.expense).toFixed(2));
		});
	}

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
