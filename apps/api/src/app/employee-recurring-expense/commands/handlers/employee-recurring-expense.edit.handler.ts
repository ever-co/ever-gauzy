import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecurringExpenseEditHandler } from '../../../shared';
import { EmployeeRecurringExpense } from '../../employee-recurring-expense.entity';
import { EmployeeRecurringExpenseService } from '../../employee-recurring-expense.service';
import { EmployeeRecurringExpenseEditCommand } from '../employee-recurring-expense.edit.command';

/**
 * This edits the value of a recurring expense.
 * To edit a recurring expense
 * 1. Change the end date of the original expense so that old value is not modified for previous expense.
 * 2. Create a new expense to have new values for all future dates.
 */
@CommandHandler(EmployeeRecurringExpenseEditCommand)
export class EmployeeRecurringExpenseEditHandler
	extends RecurringExpenseEditHandler<EmployeeRecurringExpense>
	implements ICommandHandler<EmployeeRecurringExpenseEditCommand> {
	constructor(
		private readonly employeeRecurringExpenseService: EmployeeRecurringExpenseService
	) {
		super(employeeRecurringExpenseService);
	}

	public async execute(
		command: EmployeeRecurringExpenseEditCommand
	): Promise<any> {
		const { id, input } = command;
		return await this.executeCommand(id, input);
	}
}
