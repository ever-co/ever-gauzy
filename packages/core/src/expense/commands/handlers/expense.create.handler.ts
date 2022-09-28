import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IExpense } from '@gauzy/contracts';
import { BadRequestException } from '@nestjs/common';
import { isNotEmpty } from '@gauzy/common';
import { ExpenseCreateCommand } from '../expense.create.command';
import { ExpenseService } from '../../expense.service';
import { EmployeeService } from '../../../employee/employee.service';
import { EmployeeStatisticsService } from '../../../employee-statistics';

@CommandHandler(ExpenseCreateCommand)
export class ExpenseCreateHandler implements ICommandHandler<ExpenseCreateCommand> {

	constructor(
		private readonly expenseService: ExpenseService,
		private readonly employeeService: EmployeeService,
		private readonly employeeStatisticsService: EmployeeStatisticsService
	) {}

	public async execute(command: ExpenseCreateCommand): Promise<IExpense> {
		const { input } = command;
		const expense = await this.expenseService.create(input);
		try {
			let averageExpense = 0;
			if (isNotEmpty(expense.employeeId)) {
				const { employeeId } = expense;
				const stat = await this.employeeStatisticsService.getStatisticsByEmployeeId(
					employeeId
				);
				averageExpense = this.expenseService.countStatistic(
					stat.expenseStatistics
				);
				await this.employeeService.create({
					id: employeeId,
					averageExpenses: averageExpense
				});
			}
		} catch (error) {
			throw new BadRequestException(error);
		}
		return await this.expenseService.findOneByIdString(expense.id);
	}
}
