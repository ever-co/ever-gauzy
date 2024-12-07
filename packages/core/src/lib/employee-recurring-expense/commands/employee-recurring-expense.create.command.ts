import { IEmployeeRecurringExpense } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class EmployeeRecurringExpenseCreateCommand implements ICommand {
	static readonly type = '[Employee Recurring Expense] Create';

	constructor(
		public readonly input: IEmployeeRecurringExpense
	) {}
}
