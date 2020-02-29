import { IQuery } from '@nestjs/cqrs';
import { FindConditions } from 'typeorm';
import { OrganizationRecurringExpense } from '../organization-recurring-expense.entity';

export class OrganizationRecurringExpenseFindSplitExpenseQuery
	implements IQuery {
	static readonly type = '[OrganizationRecurringExpense] Find Split Expense';

	constructor(
		public readonly orgId: string,
		public readonly findInput: FindConditions<OrganizationRecurringExpense>
	) {}
}
