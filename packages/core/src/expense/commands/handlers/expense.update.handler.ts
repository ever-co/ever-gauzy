import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IExpense } from '@gauzy/contracts';
import { ExpenseService } from '../../expense.service';
import { EmployeeService } from '../../../employee/employee.service';
import { EmployeeStatisticsService } from '../../../employee-statistics';
import { ExpenseUpdateCommand } from '../expense.update.command';
import { BadRequestException } from '@nestjs/common';
import { isNotEmpty } from '@gauzy/common';

@CommandHandler(ExpenseUpdateCommand)
export class ExpenseUpdateHandler
	implements ICommandHandler<ExpenseUpdateCommand> {
	constructor(
		private readonly expenseService: ExpenseService,
		private readonly employeeService: EmployeeService,
		private readonly employeeStatisticsService: EmployeeStatisticsService
	) {}

	public async execute(command: ExpenseUpdateCommand): Promise<IExpense> {
		let { id, entity } = command;
		const expense = await this.updateExpense(id, entity);
		try {
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
		} catch (error) {
			throw new BadRequestException(error);
		}
		return await this.expenseService.findOneByIdString(expense.id);
	}

	public async updateExpense(
		expenseId: string,
		entity: IExpense
	): Promise<IExpense> {
		try {
			return this.expenseService.create({
				id: expenseId,
				...entity
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
