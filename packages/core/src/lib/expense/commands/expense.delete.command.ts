import { ICommand } from '@nestjs/cqrs';

export class ExpenseDeleteCommand implements ICommand {
	static readonly type = '[Expense] Delete';

	constructor(
		public readonly employeeId: string,
		public readonly expenseId: string
	) {}
}
