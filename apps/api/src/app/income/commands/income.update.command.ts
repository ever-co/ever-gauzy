import { ICommand } from '@nestjs/cqrs';
import { IIncome } from '@gauzy/models';

export class IncomeUpdateCommand implements ICommand {
	static readonly type = '[Income] Update';

	constructor(public readonly id: string, public readonly entity: IIncome) {}
}
