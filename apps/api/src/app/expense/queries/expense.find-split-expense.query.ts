import { SplitExpenseFindInput } from '@gauzy/models';
import { IQuery } from '@nestjs/cqrs';

export class FindSplitExpenseQuery implements IQuery {
	static readonly type = '[Expense] Find Split Expense';

	constructor(public readonly findInput: SplitExpenseFindInput) {}
}
