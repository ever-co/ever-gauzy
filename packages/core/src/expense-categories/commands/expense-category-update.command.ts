import { IExpenseCategory } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class ExpenseCategoryUpdateCommand implements ICommand {
	static readonly type = '[ExpenseCategory] Update';

	constructor(
		public readonly id: IExpenseCategory['id'],
		public readonly input: IExpenseCategory
	) {}
}
