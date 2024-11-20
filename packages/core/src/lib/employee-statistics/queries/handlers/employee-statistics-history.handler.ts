import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { EmployeeStatisticsService } from '../../employee-statistics.service';
import * as moment from 'moment';
import {
	IEmployeeStatisticsHistory,
	EmployeeStatisticsHistoryEnum,
	IEmployeeStatisticsHistoryFindInput,
	RecurringExpenseDefaultCategoriesEnum,
	IDateRangePicker
} from '@gauzy/contracts';
import { EmployeeStatisticsHistoryQuery } from '../employee-statistics-history.query';

/**
 * Finds income, expense history
 * for past N months of an employee a given value date.
 */
@QueryHandler(EmployeeStatisticsHistoryQuery)
export class EmployeeStatisticsHistoryQueryHandler
	implements IQueryHandler<EmployeeStatisticsHistoryQuery> {
	constructor(private employeeStatisticsService: EmployeeStatisticsService) {}

	public async execute(
		command: EmployeeStatisticsHistoryQuery
	): Promise<IEmployeeStatisticsHistory[]> {
		const { input } = command;

		switch (input.type) {
			case EmployeeStatisticsHistoryEnum.INCOME:
			case EmployeeStatisticsHistoryEnum.BONUS_INCOME:
			case EmployeeStatisticsHistoryEnum.NON_BONUS_INCOME:
				return this._incomeHistory(input);

			case EmployeeStatisticsHistoryEnum.EXPENSES:
			case EmployeeStatisticsHistoryEnum.EXPENSES_WITHOUT_SALARY:
				return this._expenseHistory(input);

			default:
				return [];
		}
	}

	private async _incomeHistory(
		input: IEmployeeStatisticsHistoryFindInput
	): Promise<IEmployeeStatisticsHistory[]> {
		const {
			startDate = moment().startOf('month').toDate(),
			endDate = moment().endOf('month').toDate(),
			employeeId,
			organizationId
		} = input;

		// 1. Fetch employee's incomes for past N months from given date
		const {
			items: incomes
		} = await this.employeeStatisticsService.employeeIncomeInNMonths(
			[employeeId],
			{ startDate, endDate } as IDateRangePicker,
			organizationId
		);

		const history: IEmployeeStatisticsHistory[] = [];
		// 2. Populate  EmployeeStatisticsHistory
		incomes.forEach(({ amount, client, valueDate, notes, isBonus }) => {
			history.push({ valueDate, amount, notes, client, isBonus });
		});

		// 3. Filter Bonus, Non-Bonus or All incomes
		switch (input.type) {
			case EmployeeStatisticsHistoryEnum.BONUS_INCOME:
				return history.filter((income) => income.isBonus);

			case EmployeeStatisticsHistoryEnum.NON_BONUS_INCOME:
				return history.filter((income) => !income.isBonus);

			default:
				return history;
		}
	}

	private async _expenseHistory(
		input: IEmployeeStatisticsHistoryFindInput
	): Promise<IEmployeeStatisticsHistory[]> {
		const history: IEmployeeStatisticsHistory[] = [];

		// 1. Employee One time expenses
		await this._loadEmployeeExpenses(input, history);
		// 2. Employee Recurring Expenses
		await this._loadEmployeeRecurringExpenses(input, history);
		// 3. Organization Split Expenses
		await this._loadOrganizationSplitExpenses(input, history);
		// 4. Organization Recurring Split Expenses
		await this._loadOrganizationRecurringSplitExpenses(input, history);

		// Filter out salary expenses based on input
		return input.type ===
			EmployeeStatisticsHistoryEnum.EXPENSES_WITHOUT_SALARY
			? history.filter((stat) => !stat.isSalary)
			: history;
	}

	private async _loadEmployeeExpenses(
		input: IEmployeeStatisticsHistoryFindInput,
		history: IEmployeeStatisticsHistory[]
	) {
		const {
			startDate = moment().startOf('month').toDate(),
			endDate = moment().endOf('month').toDate(),
			employeeId,
			organizationId
		} = input;

		// 1. Fetch employee's  one time expenses for past N months from given date
		const {
			items: expenses
		} = await this.employeeStatisticsService.employeeExpenseInNMonths(
			[employeeId],
			{ startDate, endDate } as IDateRangePicker,
			organizationId
		);

		// 2. Extract required attributes from the expense and populate EmployeeStatisticsHistory
		expenses.forEach(({ valueDate, amount, notes, vendor, category }) => {
			history.push({
				valueDate,
				amount,
				notes,
				vendorName: vendor.name,
				categoryName: category.name,
				isSalary: false,
				source: 'employee'
			});
		});
	}

	private async _loadEmployeeRecurringExpenses(
		input: IEmployeeStatisticsHistoryFindInput,
		history: IEmployeeStatisticsHistory[]
	) {
		const {
			startDate = moment().startOf('month').toDate(),
			endDate = moment().endOf('month').toDate(),
			employeeId,
			organizationId
		} = input;

		// 1. Fetch employee's  recurring expenses
		const {
			items: employeeRecurringExpenses
		} = await this.employeeStatisticsService.employeeRecurringExpenses(
			[employeeId],
			{ startDate, endDate } as IDateRangePicker,
			organizationId
		);

		// 2. Filter recurring expenses based on input data and N Months and populate EmployeeStatisticsHistory
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

				// Extract required attributes from expense and Populate EmployeeStatisticsHistory
				history.push({
					valueDate: date,
					amount: expense.value,
					isRecurring: true,
					categoryName: expense.categoryName,
					isSalary:
						expense.categoryName ===
						RecurringExpenseDefaultCategoriesEnum.SALARY
				});
			}
		});
	}

	private async _loadOrganizationSplitExpenses(
		input: IEmployeeStatisticsHistoryFindInput,
		history: IEmployeeStatisticsHistory[]
	) {
		const {
			startDate = moment().startOf('month').toDate(),
			endDate = moment().endOf('month').toDate(),
			employeeId,
			organizationId
		} = input;

		// 1. Fetch employee's split expenses for past N months from given date
		const splitExpensesMap = await this.employeeStatisticsService.employeeSplitExpenseInNMonths(
			employeeId,
			{ startDate, endDate } as IDateRangePicker,
			organizationId
		);

		// 2. Extract required attributes from the expense and populate EmployeeStatisticsHistory
		splitExpensesMap.forEach((value) => {
			value.expense.forEach(({ amount, category, valueDate }) => {
				history.push({
					amount: Number((amount / value.splitAmong).toFixed(2)),
					valueDate : valueDate as Date,
					categoryName: category.name,
					splitExpense: {
						originalValue: amount,
						employeeCount: value.splitAmong
					},
					source: 'org'
				});
			});
		});
	}

	private async _loadOrganizationRecurringSplitExpenses(
		input: IEmployeeStatisticsHistoryFindInput,
		history: IEmployeeStatisticsHistory[]
	) {
		const {
			startDate = moment().startOf('month').toDate(),
			endDate = moment().endOf('month').toDate(),
			employeeId,
			organizationId
		} = input;

		// 1. Fetch employee's Organization Recurring split expenses for past N months from given date
		const splitExpensesMap = await this.employeeStatisticsService.organizationRecurringSplitExpenses(
			employeeId,
			{ startDate, endDate } as IDateRangePicker,
			organizationId
		);
		// 2. Extract required attributes from the expense and populate EmployeeStatisticsHistory
		splitExpensesMap.forEach((mapValue) => {
			mapValue.recurringExpense.forEach(({ value, categoryName }) => {
				history.push({
					amount: Number((value / mapValue.splitAmong).toFixed(2)),
					valueDate: mapValue.valueDate,
					categoryName,
					splitExpense: {
						originalValue: value,
						employeeCount: mapValue.splitAmong
					},
					source: 'org',
					isRecurring: true
				});
			});
		});
	}
}
