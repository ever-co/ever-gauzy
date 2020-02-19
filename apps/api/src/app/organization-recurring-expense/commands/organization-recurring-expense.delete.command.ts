import { RecurringExpenseDeleteInput } from '@gauzy/models';
import { ICommand } from '@nestjs/cqrs';

export class OrganizationRecurringExpenseDeleteCommand implements ICommand {
	static readonly type = '[OrganizationRecurringExpense] Delete';

	constructor(
		public readonly id: string,
		public readonly deleteInput: RecurringExpenseDeleteInput
	) {}
}
