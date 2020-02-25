import {
	BonusTypeEnum,
	EmployeeStatistics,
	EmployeeStatisticsFindInput,
	DEFAULT_PROFIT_BASED_BONUS,
	DEFAULT_REVENUE_BASED_BONUS
} from '@gauzy/models';
import { Injectable } from '@nestjs/common';
import { EmployeeService } from '../employee/employee.service';
import { ExpenseService } from '../expense';
import { IncomeService } from '../income';
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
		private employeeService: EmployeeService
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
}
