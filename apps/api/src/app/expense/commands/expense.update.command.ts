import { ICommand } from '@nestjs/cqrs';
import { IExpense } from '@gauzy/models';

export class ExpenseUpdateCommand implements ICommand {
	static readonly type = '[Expense] Update';

	constructor(public readonly id: string, public readonly entity: IExpense) {}
}
