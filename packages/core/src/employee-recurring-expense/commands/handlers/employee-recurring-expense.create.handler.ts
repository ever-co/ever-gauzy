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
export class EmployeeRecurringExpenseCreateHandler implements ICommandHandler<EmployeeRecurringExpenseCreateCommand> {
	constructor(private readonly employeeRecurringExpenseService: EmployeeRecurringExpenseService) {}

	/**
	 * Executes the command to create a recurring expense for an employee.
	 *
	 * @param command - The command containing the input data for creating the recurring expense.
	 * @returns A promise that resolves with the created employee recurring expense.
	 * @throws BadRequestException if there is an error during the creation process.
	 */
	public async execute(command: EmployeeRecurringExpenseCreateCommand): Promise<IEmployeeRecurringExpense> {
		try {
			const { input } = command;

			// If the user does not have permission to change the selected employee, set the current employee's ID
			if (!RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
				input.employeeId = RequestContext.currentEmployeeId();
			}

			// Create the recurring expense
			const recurringExpense = await this.employeeRecurringExpenseService.create(input);

			// Update the parent recurring expense to reference itself
			await this.employeeRecurringExpenseService.update(recurringExpense.id, {
				parentRecurringExpenseId: recurringExpense.id
			});

			// Return the newly created recurring expense
			return await this.employeeRecurringExpenseService.findOneByIdString(recurringExpense.id);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
