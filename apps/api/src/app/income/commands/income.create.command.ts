import { ICommand } from '@nestjs/cqrs';
import { IIncomeCreateInput } from '@gauzy/models';

export class IncomeCreateCommand implements ICommand {
	static readonly type = '[Income] Create';

	constructor(public readonly input: IIncomeCreateInput) {}
}
