import { EmployeeRecurringExpense } from '@gauzy/models';
import { ICommand } from '@nestjs/cqrs';

export class EmployeeRecurringExpenseCreateCommand implements ICommand {
	static readonly type = '[EmployeeRecurringExpense] Create';

	constructor(public readonly input: EmployeeRecurringExpense) {}
}
