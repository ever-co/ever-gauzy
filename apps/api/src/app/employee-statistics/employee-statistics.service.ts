import {
	BonusTypeEnum,
	EmployeeStatistics,
	EmployeeStatisticsFindInput,
	DEFAULT_PROFIT_BASED_BONUS,
	DEFAULT_REVENUE_BASED_BONUS
} from '@gauzy/models';
import { Injectable } from '@nestjs/common';
import { EmployeeService } from '../employee/employee.service';
import { ExpenseService } from '../expense/expense.service';
import { IncomeService } from '../income/income.service';
import { Between, In } from 'typeorm';
import { subMonths, startOfMonth, endOfMonth } from 'date-fns';
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
		private incomeService: IncomeService,
		private expenseService: ExpenseService,
		private employeeRecurringExpenseService: EmployeeRecurringExpenseService,
		private employeeService: EmployeeService,
		private organizationRecurringExpenseService: OrganizationRecurringExpenseService
	) {}

	async getStatisticsByEmployeeId(
		employeeId: string,
		findInput?: EmployeeStatisticsFindInput
	): Promise<EmployeeStatistics> {
		const mappedEmployeeIncome = (
			await this.incomeService.findAll(
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
			await this.expenseService.findAll(
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
				const foundObject = sortedEmployeeExpenses.find((o) =>
					o.hasOwnProperty(key)
				);
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
				const foundObject = sortedEmployeeIncome.find((o) =>
					o.hasOwnProperty(key)
				);
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
			const incomeStatForTheMonth = sortedEmployeeIncome.find(
				(incomeStat) => incomeStat.hasOwnProperty(month)
			);

			incomeStatForTheMonth
				? incomeStatistics.push(incomeStatForTheMonth[month])
				: incomeStatistics.push(0);

			const expenseStatForTheMonth = sortedEmployeeExpenses.find(
				(expenseStat) => expenseStat.hasOwnProperty(month)
			);

			expenseStatForTheMonth
				? expenseStatistics.push(expenseStatForTheMonth[month])
				: expenseStatistics.push(0);
		});

		const {
			organization: { bonusType, bonusPercentage }
		} = await this.employeeService.findOne(employeeId, {
			relations: ['organization']
		});

		let profitStatistics = [];
		let bonusStatistics = [];

		expenseStatistics.forEach((expenseStat, index) => {
			const income = incomeStatistics[index];
			const profit = income - expenseStat;
			const bonus = this.calculateEmployeeBonus(
				bonusType,
				bonusPercentage,
				income,
				profit
			);
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
				monthsNeeded.push(
					this._monthNames[i - 12] + ` '${currentYear}`
				);
			} else {
				monthsNeeded.push(this._monthNames[i] + ` '${currentYear - 1}`);
			}
		}

		return monthsNeeded.reverse();
	}

	private _formatDate(date: Date) {
		return `${this._monthNames[date.getMonth()]} '${date.getFullYear() -
			2000}`;
	}
	/**
	 * Return bonus value based on the bonus type and percentage
	 * For revenue based bonus, bonus is calculated based on income
	 * For profit based bonus, bonus is calculated based on profit
	 */
	calculateEmployeeBonus = (
		bonusType: string,
		bonusPercentage: number,
		income: number,
		profit: number
	) => {
		bonusType = bonusType ? bonusType : BonusTypeEnum.PROFIT_BASED_BONUS;
		switch (bonusType) {
			case BonusTypeEnum.PROFIT_BASED_BONUS:
				return (
					(profit * (bonusPercentage || DEFAULT_PROFIT_BASED_BONUS)) /
					100
				);
			case BonusTypeEnum.REVENUE_BASED_BONUS:
				return (
					(income *
						(bonusPercentage || DEFAULT_REVENUE_BASED_BONUS)) /
					100
				);
			default:
				return 0;
		}
	};

	/**
	 * helper function to create a date range to use in SQL between condition
	 */
	private _beforeDateFilter = (date: Date, lastNMonths: number) =>
		Between(
			subMonths(startOfMonth(date), lastNMonths - 1),
			endOfMonth(date)
		);

	/**
	 * Gets all income records of one or more employees(using employeeId)
	 * in last N months(lastNMonths),
	 * till the specified Date(searchMonth)
	 * lastNMonths = 1, for last 1 month and 12 for an year
	 */
	employeeIncomeInNMonths = async (
		employeeIds: string[],
		searchMonth: Date,
		lastNMonths: number
	) =>
		await this.incomeService.findAll({
			select: [
				'employeeId',
				'valueDate',
				'clientName',
				'amount',
				'currency',
				'notes',
				'isBonus'
			],
			where: {
				employee: {
					id: In(employeeIds)
				},
				valueDate: this._beforeDateFilter(searchMonth, lastNMonths)
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
		searchMonth: Date,
		lastNMonths: number
	) =>
		await this.expenseService.findAll({
			select: ['employeeId', 'valueDate', 'amount', 'currency', 'notes'],
			where: {
				employee: {
					id: In(employeeIds)
				},
				valueDate: this._beforeDateFilter(searchMonth, lastNMonths)
			},
			order: {
				valueDate: 'DESC'
			}
		});

	/**
	 * Fetch all recurring expenses of one or more employees using employeeId
	 */
	employeeRecurringExpenses = async (employeeIds: string[]) =>
		await this.employeeRecurringExpenseService.findAll({
			select: [
				'employeeId',
				'currency',
				'value',
				'categoryName',
				'startDate',
				'endDate'
			],
			where: {
				employeeId: In(employeeIds)
			}
		});

	/**
	 * Gets all expense records of a employee's organization(employeeId)
	 * that were marked to be split among its employees,
	 * in last N months(lastNMonths),till the specified Date(searchMonth)
	 * lastNMonths = 1, for last 1 month and 12 for an year
	 */
	employeeSplitExpenseInNMonths = async (
		employeeId: string,
		searchMonth: Date,
		lastNMonths: number
	) => {
		// 1 Get Employee's Organization
		const employee = await this.employeeService.findOne({
			where: {
				id: employeeId
			},
			relations: ['organization']
		});

		// 2 Find split expenses for Employee's Organization in last N months
		const { items } = await this.expenseService.findAll({
			select: ['valueDate', 'amount', 'currency', 'notes'],
			where: {
				organization: { id: employee.organization.id },
				splitExpense: true,
				valueDate: this._beforeDateFilter(searchMonth, lastNMonths)
			}
		});

		// 3. Number of employees in Employee's organization that the expense has to be split between
		const splitAmong =
			(await this.employeeService.count({
				where: {
					organization: { id: employee.organization.id }
				}
			})) || 1;
		return { items, splitAmong };
	};

	/**
	 * Fetch all recurring split expenses of the employee's Organization
	 */
	organizationRecurringSplitExpenses = async (employeeId: string) => {
		// 1 Get Employee's Organization
		const employee = await this.employeeService.findOne({
			where: {
				id: employeeId
			},
			relations: ['organization']
		});

		// 2 Fetch all split recurring expenses of the Employee's Organization
		const {
			items
		} = await this.organizationRecurringExpenseService.findAll({
			select: [
				'currency',
				'value',
				'categoryName',
				'startDate',
				'endDate'
			],
			where: {
				orgId: employee.organization.id,
				splitExpense: true
			}
		});

		// 3. Number of employees in Employee's organization that the expense has to be split between
		const splitAmong =
			(await this.employeeService.count({
				where: {
					organization: { id: employee.organization.id }
				}
			})) || 1;

		return { items, splitAmong };
	};
}
