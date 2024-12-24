import { IFindStartDateUpdateTypeInput } from '@gauzy/contracts';
import { IQuery } from '@nestjs/cqrs';

export class EmployeeRecurringExpenseStartDateUpdateTypeQuery
	implements IQuery {
	static readonly type = '[EmployeeRecurringExpense] Start Date Update Type';

	constructor(public readonly input: IFindStartDateUpdateTypeInput) {}
}
