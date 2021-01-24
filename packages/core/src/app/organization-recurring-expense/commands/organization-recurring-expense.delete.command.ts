import { IRecurringExpenseDeleteInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class OrganizationRecurringExpenseDeleteCommand implements ICommand {
	static readonly type = '[OrganizationRecurringExpense] Delete';

	constructor(
		public readonly id: string,
		public readonly deleteInput: IRecurringExpenseDeleteInput
	) {}
}
