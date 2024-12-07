import { IExpenseCategory } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class ExpenseCategoryCreateCommand implements ICommand {
	static readonly type = '[ExpenseCategory] Create';

	constructor(
		public readonly input: IExpenseCategory
	) {}
}
