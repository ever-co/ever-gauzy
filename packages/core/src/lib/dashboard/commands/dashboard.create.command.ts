import { ICommand } from '@nestjs/cqrs';
import { IDashboardCreateInput } from '@gauzy/contracts';

export class DashboardCreateCommand implements ICommand {
	static readonly type = '[Dashboard] Create';

	constructor(public readonly input: IDashboardCreateInput) {}
}
