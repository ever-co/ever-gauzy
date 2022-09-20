import { IEmployeeRecurringExpense, PermissionsEnum } from '@gauzy/contracts';
import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RequestContext } from './../../../core/context';
import { EmployeeRecurringExpenseService } from '../../employee-recurring-expense.service';
import { EmployeeRecurringExpenseCreateCommand } from '../employee-recurring-expense.create.command';

/**
 * Creates a recurring expense for an employee.
 * The parentRecurringExpenseId is it's own id since this is a new expense.
 */
@CommandHandler(EmployeeRecurringExpenseCreateCommand)
export class EmployeeRecurringExpenseCreateHandler
	implements ICommandHandler<EmployeeRecurringExpenseCreateCommand> {
	constructor(
		private readonly employeeRecurringExpenseService: EmployeeRecurringExpenseService
	) {}

	public async execute(
		command: EmployeeRecurringExpenseCreateCommand
	): Promise<IEmployeeRecurringExpense> {
		try {
			const { input } = command;
			/**
			 * If employee create self recurring expense
			 */
			if (!RequestContext.hasPermission(
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
			)) {
				input.employeeId = RequestContext.currentEmployeeId();
			} else {
				input.employeeId = input.employeeId || null;
			}
			const recurringExpense = await this.employeeRecurringExpenseService.create(
				input
			);
			await this.employeeRecurringExpenseService.update(recurringExpense.id, {
				parentRecurringExpenseId: recurringExpense.id
			});
			return await this.employeeRecurringExpenseService.findOneByIdString(recurringExpense.id)
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
