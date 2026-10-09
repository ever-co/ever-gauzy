import { BadRequestException, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { isNotEmpty } from '@gauzy/utils';
import { ID, IExpense } from '@gauzy/contracts';
import { ExpenseService } from '../../expense.service';
import { EmployeeService } from '../../../employee/employee.service';
import { EmployeeStatisticsService } from '../../../employee-statistics';
import { ExpenseUpdateCommand } from '../expense.update.command';

@CommandHandler(ExpenseUpdateCommand)
export class ExpenseUpdateHandler implements ICommandHandler<ExpenseUpdateCommand> {
	private readonly logger = new Logger(ExpenseUpdateHandler.name);

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

			if (isNotEmpty(employeeId)) {
				await this.refreshAverageExpenses(employeeId);
			}
			return expense;
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * The expense is already saved at this point: a failed refresh (e.g. the expense still points to a
	 * soft-deleted employee) is logged instead of reporting the saved update as failed.
	 */
	private async refreshAverageExpenses(employeeId: ID): Promise<void> {
		try {
			const statistic = await this.employeeStatisticsService.getStatisticsByEmployeeId(employeeId);
			await this.employeeService.create({
				id: employeeId,
				averageExpenses: this.expenseService.countStatistic(statistic.expenseStatistics)
			});
		} catch (error) {
			this.logger.warn(`Average expenses of employee ${employeeId} not refreshed: ${error?.message ?? error}`);
		}
	}
}
