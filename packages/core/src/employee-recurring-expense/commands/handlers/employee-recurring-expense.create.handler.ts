import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
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
	): Promise<any> {
		const { input } = command;
		const createdExpense = await this.employeeRecurringExpenseService.create(
			input
		);

		await this.employeeRecurringExpenseService.update(createdExpense.id, {
			parentRecurringExpenseId: createdExpense.id
		});

		return {
			...createdExpense,
			parentRecurringExpenseId: createdExpense.id
		};
	}
}
