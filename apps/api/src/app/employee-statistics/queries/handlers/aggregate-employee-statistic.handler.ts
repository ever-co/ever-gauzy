import {
	Invite,
	AggregatedEmployeeStatistic,
	StatisticSum
} from '@gauzy/models';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { AggregatedEmployeeStatisticQuery } from '../aggregate-employee-statistic.query';
import { IncomeService } from '../../../income';
import { ExpenseService } from '../../../expense';
import { EmployeeService } from '../../../employee/employee.service';

/**
 * Finds income, expense, profit and bonus for all employees for the given month.
 * If month is not specified, finds from the start of time till now.
 */
@QueryHandler(AggregatedEmployeeStatisticQuery)
export class AggregateOrganizationQueryHandler
	implements IQueryHandler<AggregatedEmployeeStatisticQuery> {
	constructor(
		private employeeService: EmployeeService,
		private incomeService: IncomeService,
		private expenseService: ExpenseService
	) {}

	public async execute(
		command: AggregatedEmployeeStatisticQuery
	): Promise<AggregatedEmployeeStatistic> {
		const { input } = command;

		const total: StatisticSum = {
			income: 0,
			expense: 0,
			profit: 0,
			bonus: 0
		};

		const incomes = (await this.incomeService.findAll(
			{
				where: {
					organization: {
						id: input.organizationId
					}
				}
			},
			input.filterDate ? input.filterDate.toString() : null
		)).items.reduce(this.aggregateAmountByEmployeeId, {});

		const expenses = (await this.expenseService.findAll(
			{
				where: {
					organization: {
						id: input.organizationId
					}
				}
			},
			input.filterDate ? input.filterDate.toString() : null
		)).items.reduce(this.aggregateAmountByEmployeeId, {});

		const employees = (await this.employeeService.findAll({
			where: {
				organization: {
					id: input.organizationId
				}
			},
			relations: ['user']
		})).items
			.map((employee) => {
				const income = Math.floor(incomes[employee.id]) || 0;
				const expense = Math.floor(expenses[employee.id]) || 0;
				const profit = Math.floor(income - expense);
				const bonus = Math.floor((profit * 75) / 100);

				total.income += income;
				total.expense += expense;
				total.profit += profit;
				total.bonus += bonus;

				return {
					employee,
					income,
					expense,
					profit,
					bonus
				};
			})
			.sort((a, b) => b.bonus - a.bonus);

		return {
			total,
			employees
		};
	}

	aggregateAmountByEmployeeId = (
		emailByEmployeeId,
		currentValue: {
			employeeId?: string;
			amount: number;
		}
	) => {
		emailByEmployeeId[currentValue.employeeId] =
			(emailByEmployeeId[currentValue.employeeId] || 0) +
			+currentValue.amount;
		return emailByEmployeeId;
	};
}
