import { IRecurringExpenseDeleteInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class EmployeeRecurringExpenseDeleteCommand implements ICommand {
	static readonly type = '[EmployeeRecurringExpense] Delete';

	constructor(
		public readonly id: string,
		public readonly deleteInput: IRecurringExpenseDeleteInput
	) {}
}
