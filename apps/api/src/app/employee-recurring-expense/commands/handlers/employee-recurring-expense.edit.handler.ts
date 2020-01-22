import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
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
	implements ICommandHandler<EmployeeRecurringExpenseEditCommand> {
	constructor(
		private readonly employeeRecurringExpenseService: EmployeeRecurringExpenseService
	) {}

	public async execute(
		command: EmployeeRecurringExpenseEditCommand
	): Promise<any> {
		const { id, input } = command;

		const originalExpense = await this.employeeRecurringExpenseService.findOne(
			id
		);

		if (
			originalExpense.startDay === input.startDay &&
			originalExpense.startMonth === input.startMonth &&
			originalExpense.startYear === input.startYear
		) {
			return await this.employeeRecurringExpenseService.update(id, input);
		}

		await this.employeeRecurringExpenseService.update(id, {
			endDay: input.startDay,
			endMonth: input.startMonth > 1 ? input.startMonth - 1 : 12, //Because from input.startMonth the new value will be considered
			endYear:
				input.startMonth > 1 ? input.startYear : input.startYear - 1
		});

		const newExpense = await this.employeeRecurringExpenseService.create({
			employeeId: originalExpense.employeeId,
			startDay: input.startDay,
			startMonth: input.startMonth,
			startYear: input.startYear,
			endDay: originalExpense.endDay,
			endMonth: originalExpense.endMonth,
			endYear: originalExpense.endYear,
			value: input.value,
			categoryName: originalExpense.categoryName,
			currency: originalExpense.currency
		});

		return newExpense;
	}
}
