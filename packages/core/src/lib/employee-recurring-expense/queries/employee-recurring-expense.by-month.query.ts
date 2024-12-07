import { IEmployeeRecurringExpenseByMonthFindInput } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

export class EmployeeRecurringExpenseByMonthQuery implements IQuery {
	static readonly type = '[EmployeeRecurringExpense] By Month';

	constructor(
		public readonly input: IEmployeeRecurringExpenseByMonthFindInput,
		public readonly relations: string[] = []
	) {}
}
