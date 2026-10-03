import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { isNotEmpty } from '@gauzy/utils';
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
			const existing = await this.expenseService.findOneByIdString(id);
			const expense = await this.expenseService.create({ ...entity, id });

			// The update DTO does not accept `employeeId` (it is whitelisted out), so the saved partial has none:
			// take the employee from the stored expense to refresh that employee's average.
			const employeeId = expense.employeeId ?? existing.employeeId;

			let averageExpense = 0;
			if (isNotEmpty(employeeId)) {
				const statistic = await this.employeeStatisticsService.getStatisticsByEmployeeId(employeeId);
				averageExpense = this.expenseService.countStatistic(statistic.expenseStatistics);
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
