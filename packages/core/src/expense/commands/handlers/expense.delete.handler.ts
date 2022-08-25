import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { isNotEmpty } from '@gauzy/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { ExpenseService } from '../../expense.service';
import { EmployeeService } from '../../../employee/employee.service';
import { EmployeeStatisticsService } from '../../../employee-statistics';
import { ExpenseDeleteCommand } from '../expense.delete.command';
import { RequestContext } from './../../../core/context';

@CommandHandler(ExpenseDeleteCommand)
export class ExpenseDeleteHandler
	implements ICommandHandler<ExpenseDeleteCommand> {
	constructor(
		private readonly expenseService: ExpenseService,
		private readonly employeeService: EmployeeService,
		private readonly employeeStatisticsService: EmployeeStatisticsService
	) {}

	public async execute(command: ExpenseDeleteCommand): Promise<DeleteResult> {
		const { expenseId } = command;
		const result = await this.deleteExpense(expenseId);
		try {
			const { employeeId } = command;
			if (isNotEmpty(employeeId)) {
				let averageExpense = 0;
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
		return result;
	}

	public async deleteExpense(expenseId: string): Promise<DeleteResult> {
		try {
			if (RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)) {
				return await this.expenseService.delete(expenseId);
			} else {
				return await this.expenseService.delete({
					id: expenseId,
					employeeId: RequestContext.currentEmployeeId(),
					tenantId: RequestContext.currentTenantId()
				});
			}
		} catch (error) {
			throw new ForbiddenException();
		}
	}
}
