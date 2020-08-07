import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ExpenseService } from '../../expense.service';
import { EmployeeService } from '../../../employee/employee.service';
import { EmployeeStatisticsService } from '../../../employee-statistics';
import { ExpenseDeleteCommand } from '../expense.delete.command';

@CommandHandler(ExpenseDeleteCommand)
export class ExpenseDeleteHandler
	implements ICommandHandler<ExpenseDeleteCommand> {
	constructor(
		private readonly expenseService: ExpenseService,
		private readonly employeeService: EmployeeService,
		private readonly employeeStatisticsService: EmployeeStatisticsService
	) {}

	public async execute(command: ExpenseDeleteCommand): Promise<any> {
		const { employeeId, expenseId } = command;
		const id = employeeId;
		let averageExpense = 0;
		await this.deleteExpense(expenseId);

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

	public async deleteExpense(expenseId: string): Promise<any> {
		return await this.expenseService.delete(expenseId);
	}
}
