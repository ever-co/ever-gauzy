import { AggregatedEmployeeStatistic, StatisticSum } from '@gauzy/models';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AggregatedEmployeeStatisticQuery } from '../aggregate-employee-statistic.query';
import { IncomeService } from '../../../income';
import { ExpenseService } from '../../../expense';
import { EmployeeService } from '../../../employee/employee.service';
import { OrganizationService } from '../../../organization/organization.service';
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
		private incomeService: IncomeService,
		private expenseService: ExpenseService,
		private organizationService: OrganizationService,
		private employeeStatisticsService: EmployeeStatisticsService
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

		const incomes = (
			await this.incomeService.findAll(
				{
					where: {
						organization: {
							id: input.organizationId
						}
					}
				},
				input.filterDate ? input.filterDate.toString() : null
			)
		).items.reduce(this.aggregateAmountByEmployeeId, {});

		const expenses = (
			await this.expenseService.findAll(
				{
					where: {
						organization: {
							id: input.organizationId
						}
					}
				},
				input.filterDate ? input.filterDate.toString() : null
			)
		).items.reduce(this.aggregateAmountByEmployeeId, {});

		const {
			bonusType,
			bonusPercentage
		} = await this.organizationService.findOne({
			id: input.organizationId
		});

		const employees = (
			await this.employeeService.findAll({
				where: {
					organization: {
						id: input.organizationId
					}
				},
				relations: ['user']
			})
		).items
			.map((employee) => {
				const income = Math.floor(incomes[employee.id]) || 0;
				const expense = Math.floor(expenses[employee.id]) || 0;
				const profit = Math.floor(income - expense);
				const bonus = Math.floor(
					this.employeeStatisticsService.calculateEmployeeBonus(
						bonusType,
						bonusPercentage,
						income,
						profit
					)
				);

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
