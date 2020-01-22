import { EmployeeRecurringExpenseByMonthFindInput } from '@gauzy/models';
import { IQuery } from '@nestjs/cqrs';

export class EmployeeRecurringExpenseByMonthQuery implements IQuery {
	static readonly type = '[EmployeeRecurringExpense] By Month';

	constructor(
		public readonly input: EmployeeRecurringExpenseByMonthFindInput
	) {}
}
