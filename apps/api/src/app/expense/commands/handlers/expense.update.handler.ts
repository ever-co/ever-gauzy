import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ExpenseService } from '../../expense.service';
import { EmployeeService } from '../../../employee/employee.service';
import { EmployeeStatisticsService } from '../../../employee-statistics';
import { ExpenseUpdateCommand } from '../expense.update.command';
import { Expense } from '@gauzy/models';

@CommandHandler(ExpenseUpdateCommand)
export class ExpenseUpdateHandler
	implements ICommandHandler<ExpenseUpdateCommand> {
	constructor(
		private readonly expenseService: ExpenseService,
		private readonly employeeService: EmployeeService,
		private readonly employeeStatisticsService: EmployeeStatisticsService
	) {}

	public async execute(command: ExpenseUpdateCommand): Promise<any> {
		let { id } = command;
		const { entity } = command;
		const expense = await this.updateExpense(id, entity);
		let averageExpense = 0;
		if (expense) {
			id = expense.employeeId;

			const stat = await this.employeeStatisticsService.getStatisticsByEmployeeId(
				id
			);

			averageExpense = this.expenseService.countStatistic(
				stat.expenseStatistics
			);

			return await this.employeeService.create({
				id,
				averageExpenses: averageExpense
			});
		}
	}

	public async updateExpense(
		expenseId: string,
		entity: Expense
	): Promise<Expense> {
		const id = expenseId;
		return this.expenseService.create({
			id,
			...entity
		});
	}
}
