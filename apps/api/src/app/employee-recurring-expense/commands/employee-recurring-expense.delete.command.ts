import { RecurringExpenseDeleteInput } from '@gauzy/models';
import { ICommand } from '@nestjs/cqrs';

export class EmployeeRecurringExpenseDeleteCommand implements ICommand {
	static readonly type = '[EmployeeRecurringExpense] Delete';

	constructor(
		public readonly id: string,
		public readonly deleteInput: RecurringExpenseDeleteInput
	) {}
}
