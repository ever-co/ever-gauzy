import { ICommand } from '@nestjs/cqrs';
import { IActivityLogCreateInput } from '@gauzy/contracts';

export class ActivityLogCreateCommand implements ICommand {
	static readonly type = '[Activity Logs] Create';

	constructor(public readonly input: IActivityLogCreateInput) {}
}
