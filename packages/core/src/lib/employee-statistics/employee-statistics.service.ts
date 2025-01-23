import { Injectable } from '@nestjs/common';
import * as moment from 'moment';
import { DEFAULT_PROFIT_BASED_BONUS, DEFAULT_REVENUE_BASED_BONUS } from '@gauzy/constants';
import {
	BonusTypeEnum,
	IEmployeeStatistics,
	IEmployeeStatisticsFindInput,
	IMonthAggregatedSplitExpense,
	IDateRangePicker
} from '@gauzy/contracts';
import { EmployeeService } from '../employee/employee.service';
import { ExpenseService } from '../expense/expense.service';
import { IncomeService } from '../income/income.service';
import { Between, In, LessThanOrEqual, MoreThanOrEqual, IsNull } from 'typeorm';
import { EmployeeRecurringExpenseService } from '../employee-recurring-expense/employee-recurring-expense.service';
import { OrganizationRecurringExpenseService } from '../organization-recurring-expense/organization-recurring-expense.service';

@Injectable()
export class EmployeeStatisticsService {
	private _monthNames = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];

	constructor(
		private readonly incomeService: IncomeService,
		private readonly expenseService: ExpenseService,
		private readonly employeeRecurringExpenseService: EmployeeRecurringExpenseService,
		private readonly employeeService: EmployeeService,
		private readonly organizationRecurringExpenseService: OrganizationRecurringExpenseService
	) {}

	async getStatisticsByEmployeeId(
		employeeId: string,
		findInput?: IEmployeeStatisticsFindInput
	): Promise<IEmployeeStatistics> {
		const mappedEmployeeIncome = (
			await this.incomeService.findAllIncomes(
				{
					where: {
						employee: {
							id: employeeId
						}
					}
				},
				findInput ? findInput.valueDate.toString() : null
			)
		).items.map((e) => {
			const obj = {};
			const formattedDate = this._formatDate(e.valueDate);

			obj[formattedDate] = +e.amount;

			return obj;
		});

		const mappedEmployeeExpenses = (
			await this.expenseService.findAllExpenses(
				{
					where: {
						employee: {
							id: employeeId
						}
					}
				},
				findInput ? findInput.valueDate.toString() : null
			)
		).items.map((e) => {
			const obj = {};
			const formattedDate = this._formatDate(e.valueDate);

			obj[formattedDate] = +e.amount;

			return obj;
		});

		const sortedEmployeeExpenses: Object[] = [];

		mappedEmployeeExpenses.forEach((obj) => {
			// tslint:disable-next-line: forin
			for (const key in obj) {
				const foundObject = sortedEmployeeExpenses.find((o) => o.hasOwnProperty(key));
				if (foundObject) {
					foundObject[key] += obj[key];
				} else {
					sortedEmployeeExpenses.push(obj);
				}
			}
		});

		const sortedEmployeeIncome: Object[] = [];

		mappedEmployeeIncome.forEach((obj) => {
			// tslint:disable-next-line: forin
			for (const key in obj) {
				const foundObject = sortedEmployeeIncome.find((o) => o.hasOwnProperty(key));
				if (foundObject) {
					foundObject[key] += obj[key];
				} else {
					sortedEmployeeIncome.push(obj);
				}
			}
		});

		let incomeStatistics = [];
		let expenseStatistics = [];

		this._getLast12months().forEach((month) => {
			const incomeStatForTheMonth = sortedEmployeeIncome.find((incomeStat) => incomeStat.hasOwnProperty(month));

			incomeStatForTheMonth ? incomeStatistics.push(incomeStatForTheMonth[month]) : incomeStatistics.push(0);

			const expenseStatForTheMonth = sortedEmployeeExpenses.find((expenseStat) =>
				expenseStat.hasOwnProperty(month)
			);

			expenseStatForTheMonth ? expenseStatistics.push(expenseStatForTheMonth[month]) : expenseStatistics.push(0);
		});

		const {
			organization: { bonusType, bonusPercentage }
		} = await this.employeeService.findOneByIdString(employeeId, {
			relations: ['organization']
		});

		let profitStatistics = [];
		let bonusStatistics = [];

		expenseStatistics.forEach((expenseStat, index) => {
			const income = incomeStatistics[index];
			const profit = income - expenseStat;
			const bonus = this.calculateEmployeeBonus(bonusType, bonusPercentage, income, profit);
			profitStatistics.push(profit);
			bonusStatistics.push(bonus);
		});

		if (findInput && findInput.valueDate) {
			expenseStatistics = expenseStatistics.filter(Number);
			incomeStatistics = incomeStatistics.filter(Number);
			profitStatistics = profitStatistics.filter(Number);
			bonusStatistics = bonusStatistics.filter(Number);
		}
		return {
			expenseStatistics,
			incomeStatistics,
			profitStatistics,
			bonusStatistics
		};
	}

	private _getLast12months() {
		const start = new Date(Date.now()).getMonth() + 1;
		const end = start + 11;
		const currentYear = new Date(Date.now()).getFullYear() - 2000;

		const monthsNeeded = [];

		for (let i = start; i <= end; i++) {
			if (i > 11) {
				monthsNeeded.push(this._monthNames[i - 12] + ` '${currentYear}`);
			} else {
				monthsNeeded.push(this._monthNames[i] + ` '${currentYear - 1}`);
			}
		}

		return monthsNeeded.reverse();
	}

	private _formatDate(date: Date) {
		return `${this._monthNames[date.getMonth()]} '${date.getFullYear() - 2000}`;
	}
	/**
	 * Return bonus value based on the bonus type and percentage
	 * For revenue based bonus, bonus is calculated based on income
	 * For profit based bonus, bonus is calculated based on profit
	 */
	calculateEmployeeBonus = (bonusType: string, bonusPercentage: number, income: number, profit: number) => {
		bonusType = bonusType ? bonusType : BonusTypeEnum.PROFIT_BASED_BONUS;
		switch (bonusType) {
			case BonusTypeEnum.PROFIT_BASED_BONUS:
				return (profit * (bonusPercentage || DEFAULT_PROFIT_BASED_BONUS)) / 100;
			case BonusTypeEnum.REVENUE_BASED_BONUS:
				return (income * (bonusPercentage || DEFAULT_REVENUE_BASED_BONUS)) / 100;
			default:
				return 0;
		}
	};

	/**
	 * Gets all income records of one or more employees(using employeeId)
	 * in last N months(lastNMonths),
	 * till the specified Date(searchMonth)
	 * lastNMonths = 1, for last 1 month and 12 for an year
	 */
	employeeIncomeInNMonths = async (
		employeeIds: string[],
		{ startDate, endDate }: IDateRangePicker,
		organizationId: string
	) =>
		await this.incomeService.findAll({
			select: ['employeeId', 'valueDate', 'amount', 'currency', 'notes', 'isBonus'],
			join: {
				alias: 'income',
				leftJoinAndSelect: {
					client: 'income.client'
				}
			},
			where: {
				organizationId,
				employee: {
					id: In(employeeIds)
				},
				valueDate: Between<Date>(
					moment(moment(startDate).format('YYYY-MM-DD HH:mm:ss.SSS')).toDate(),
					moment(moment(endDate).format('YYYY-MM-DD HH:mm:ss.SSS')).toDate()
				)
			},
			order: {
				valueDate: 'DESC'
			}
		});

	/**
	 * Gets all expense records of one or more employees(using employeeId)
	 * in last N months(lastNMonths),
	 * till the specified Date(searchMonth)
	 * lastNMonths = 1, for last 1 month and 12 for an year
	 */
	employeeExpenseInNMonths = async (
		employeeIds: string[],
		{ startDate, endDate }: IDateRangePicker,
		organizationId: string
	) =>
		await this.expenseService.findAll({
			select: ['employeeId', 'valueDate', 'amount', 'currency', 'notes', 'vendor', 'category'],
			where: {
				organizationId,
				employee: {
					id: In(employeeIds)
				},
				splitExpense: false,
				valueDate: Between<Date>(
					moment(moment(startDate).format('YYYY-MM-DD HH:mm:ss.SSS')).toDate(),
					moment(moment(endDate).format('YYYY-MM-DD HH:mm:ss.SSS')).toDate()
				)
			},
			order: {
				valueDate: 'DESC'
			},
			relations: ['vendor', 'category']
		});

	/**
	 * Fetch all recurring expenses of one or more employees using employeeId
	 */
	employeeRecurringExpenses = async (
		employeeIds: string[],
		{ startDate, endDate }: IDateRangePicker,
		organizationId: string
	) =>
		await this.employeeRecurringExpenseService.findAll({
			select: ['employeeId', 'currency', 'value', 'categoryName', 'startDate', 'endDate'],
			where: [
				{
					employeeId: In(employeeIds),
					organizationId,
					startDate: LessThanOrEqual(endDate),
					endDate: MoreThanOrEqual(startDate)
				},
				{
					employeeId: In(employeeIds),
					organizationId,
					startDate: LessThanOrEqual(endDate),
					endDate: IsNull()
				}
			]
		});

	/**
	 * Gets all expense records of a employee's organization(employeeId)
	 * that were marked to be split among its employees,
	 * in last N months(lastNMonths),till the specified Date(searchMonth)
	 * lastNMonths = 1, for last 1 month and 12 for an year
	 *
	 * @returns {Promise<Map<string, IMonthAggregatedSplitExpense>>} A map with
	 * the key as 'month-year' for every month in the range & for which at least
	 * one expense is available
	 */
	employeeSplitExpenseInNMonths = async (
		employeeId: string,
		{ startDate, endDate }: IDateRangePicker,
		organizationId: string
	): Promise<Map<string, IMonthAggregatedSplitExpense>> => {
		// 1 Get Employee's Organization
		const employee = await this.employeeService.findOneByOptions({
			where: {
				id: employeeId,
				organizationId
			},
			relations: ['organization']
		});

		// 2 Find split expenses for Employee's Organization in last N months
		const { items } = await this.expenseService.findAll({
			select: ['valueDate', 'amount', 'currency', 'notes', 'category'],
			where: {
				organization: { id: employee.organization.id },
				splitExpense: true,
				valueDate: Between(moment(startDate).toDate(), moment(endDate).toDate())
			},
			relations: ['category']
		});

		const monthlySplitExpenseMap: Map<string, IMonthAggregatedSplitExpense> = new Map();

		// 3 Find the number of active employees for each month, and split the expenses among the active employees for each month
		for (const expense of items) {
			const key = `${expense.valueDate.getMonth()}-${expense.valueDate.getFullYear()}`;
			const amount = Number(expense.amount);

			if (monthlySplitExpenseMap.has(key)) {
				// Update expense statistics values in map if key pre-exists
				const stat = monthlySplitExpenseMap.get(key);
				const splitAmount = amount / stat.splitAmong;
				stat.splitExpense = Number((splitAmount + stat.splitExpense).toFixed(2));
				stat.expense.push(expense);
			} else {
				// Add a new map entry if the key(month-year) does not already exist
				const { total: splitAmong } = await this.employeeService.findWorkingEmployees(
					employee.organization.id,
					expense.valueDate
				);

				const newStat = {
					month: expense.valueDate.getMonth(),
					year: expense.valueDate.getFullYear(),
					splitExpense: Number((amount / splitAmong).toFixed(2)),
					splitAmong,
					expense: [expense]
				};

				monthlySplitExpenseMap.set(key, newStat);
			}
		}

		return monthlySplitExpenseMap;
	};

	/**
	 * Fetch all recurring split expenses of the employee's Organization
	 */
	organizationRecurringSplitExpenses = async (
		employeeId: string,
		{ startDate, endDate }: IDateRangePicker,
		organizationId: string
	) => {
		// 1 Get Employee's Organization
		const employee = await this.employeeService.findOneByOptions({
			where: {
				id: employeeId,
				organizationId
			},
			relations: ['organization']
		});

		// 2 Fetch all split recurring expenses of the Employee's Organization
		const { items } = await this.organizationRecurringExpenseService.findAll({
			select: ['currency', 'value', 'categoryName', 'startDate', 'endDate'],
			where: [
				{
					organizationId: employee.organization.id,
					splitExpense: true,
					startDate: LessThanOrEqual(endDate),
					endDate: MoreThanOrEqual(startDate)
				},
				{
					organizationId: employee.organization.id,
					splitExpense: true,
					startDate: LessThanOrEqual(endDate),
					endDate: IsNull()
				}
			]
		});

		const monthlySplitExpenseMap: Map<string, IMonthAggregatedSplitExpense> = new Map();

		/**
		 * Add Organization split recurring expense from the
		 * expense start date
		 * OR
		 * past N months to each month's expense, whichever is lesser
		 * Stop adding recurring expenses at the month where it was stopped
		 * OR
		 * till the input date
		 */
		for (const expense of items) {
			// Find start date based on input date and X months.
			const inputStartDate = startDate;

			/**
			 * Add Organization split recurring expense from the
			 * expense start date
			 * OR
			 * past N months to each month's expense, whichever is more recent
			 */
			const requiredStartDate = expense.startDate > inputStartDate ? expense.startDate : inputStartDate;

			for (
				const date = new Date(requiredStartDate);
				date <= new Date(endDate);
				date.setMonth(date.getMonth() + 1)
			) {
				// Stop loading expense if the split recurring expense has ended before input date
				if (expense.endDate && date > expense.endDate) break;

				const key = `${date.getMonth()}-${date.getFullYear()}`;
				const amount = Number(expense.value);
				if (monthlySplitExpenseMap.has(key)) {
					// Update expense statistics values in map if key pre-exists
					const stat = monthlySplitExpenseMap.get(key);
					const splitExpense = amount / stat.splitAmong;
					stat.splitExpense = Number((splitExpense + stat.splitExpense).toFixed(2));
					stat.recurringExpense.push(expense);
					stat.valueDate = date;
				} else {
					const { total: splitAmong } = await this.employeeService.findWorkingEmployees(
						employee.organization.id,
						date
					);

					// Add a new map entry if the key(month-year) does not already exist
					const newStat: IMonthAggregatedSplitExpense = {
						month: date.getMonth(),
						year: date.getFullYear(),
						splitExpense: Number((amount / splitAmong).toFixed(2)),
						splitAmong,
						recurringExpense: [expense],
						valueDate: date
					};

					monthlySplitExpenseMap.set(key, newStat);
				}
			}
		}

		return monthlySplitExpenseMap;
	};
}
