import { IRecurringExpenseEditInput as IExpenseEditInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class EmployeeRecurringExpenseEditCommand implements ICommand {
	static readonly type = '[EmployeeRecurringExpense] Edit';

	constructor(
		public readonly id: string,
		public readonly input: IExpenseEditInput
	) {}
}
