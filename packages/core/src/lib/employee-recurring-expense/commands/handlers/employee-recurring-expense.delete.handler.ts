import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecurringExpenseDeleteHandler } from '../../../shared';
import { EmployeeRecurringExpense } from '../../employee-recurring-expense.entity';
import { EmployeeRecurringExpenseService } from '../../employee-recurring-expense.service';
import { EmployeeRecurringExpenseDeleteCommand } from '../employee-recurring-expense.delete.command';

/**
 * Deletes a EmployeeRecurringExpense based on command.deleteInput.deletionType:
 *
 * 1. ALL: Delete all entries for an expense (By actually deleting it from the db)
 * 2. FUTURE : Delete only current and future events (By reducing the end date)
 * 3. CURRENT : Delete only one month (By splitting the expense into two)
 *
 */
@CommandHandler(EmployeeRecurringExpenseDeleteCommand)
export class EmployeeRecurringExpenseDeleteHandler
	extends RecurringExpenseDeleteHandler<EmployeeRecurringExpense>
	implements ICommandHandler<EmployeeRecurringExpenseDeleteCommand> {
	constructor(
		private readonly employeeRecurringExpenseService: EmployeeRecurringExpenseService
	) {
		super(employeeRecurringExpenseService);
	}

	public async execute(
		command: EmployeeRecurringExpenseDeleteCommand
	): Promise<any> {
		const { id, deleteInput } = command;
		return await this.executeCommand(id, deleteInput);
	}
}
