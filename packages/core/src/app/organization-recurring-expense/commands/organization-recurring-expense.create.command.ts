import { IOrganizationRecurringExpense } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class OrganizationRecurringExpenseCreateCommand implements ICommand {
	static readonly type = '[OrganizationRecurringExpense] Create';

	constructor(public readonly input: IOrganizationRecurringExpense) {}
}
