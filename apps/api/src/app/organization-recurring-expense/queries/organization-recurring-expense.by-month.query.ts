import { OrganizationRecurringExpenseByMonthFindInput } from '@gauzy/models';
import { IQuery } from '@nestjs/cqrs';

export class OrganizationRecurringExpenseByMonthQuery implements IQuery {
	static readonly type = '[OrganizationRecurringExpense] By Month';

	constructor(
		public readonly input: OrganizationRecurringExpenseByMonthFindInput
	) {}
}
