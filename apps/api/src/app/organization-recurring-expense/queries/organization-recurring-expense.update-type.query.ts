import { IFindStartDateUpdateTypeInput } from '@gauzy/models';
import { IQuery } from '@nestjs/cqrs';

export class OrganizationRecurringExpenseStartDateUpdateTypeQuery
	implements IQuery {
	static readonly type =
		'[OrganizationRecurringExpense] Start Date Update Type';

	constructor(public readonly input: IFindStartDateUpdateTypeInput) {}
}
