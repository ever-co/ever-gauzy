import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { isNotEmpty } from '@gauzy/common';
import { IExpense } from '@gauzy/contracts';
import { ExpenseService } from '../../expense.service';
import { EmployeeService } from '../../../employee/employee.service';
import { EmployeeStatisticsService } from '../../../employee-statistics';
import { ExpenseUpdateCommand } from '../expense.update.command';

@CommandHandler(ExpenseUpdateCommand)
export class ExpenseUpdateHandler implements ICommandHandler<ExpenseUpdateCommand> {

	constructor(
		private readonly expenseService: ExpenseService,
		private readonly employeeService: EmployeeService,
		private readonly employeeStatisticsService: EmployeeStatisticsService
	) {}

	public async execute(command: ExpenseUpdateCommand): Promise<IExpense> {
		let { id, entity } = command;
		try {
			await this.expenseService.findOneByIdString(id);
			const expense = await this.expenseService.create({
				id,
				...entity
			});
			let averageExpense = 0;
			if (isNotEmpty(expense.employeeId)) {
				const { employeeId } = expense;
				const statistic = await this.employeeStatisticsService.getStatisticsByEmployeeId(
					employeeId
				);
				averageExpense = this.expenseService.countStatistic(
					statistic.expenseStatistics
				);
				await this.employeeService.create({
					id: employeeId,
					averageExpenses: averageExpense
				});
			}
			return expense;
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
