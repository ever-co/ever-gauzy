import { ICommand } from '@nestjs/cqrs';
import { IExpenseCreateInput } from '@gauzy/models';

export class ExpenseCreateCommand implements ICommand {
	static readonly type = '[Expense] Create';

	constructor(public readonly input: IExpenseCreateInput) {}
}
