import { ITaskViewUpdateInput } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class TaskViewUpdateCommand implements ICommand {
	static readonly type = '[Task View] Update';

	constructor(public readonly input: ITaskViewUpdateInput) {}
}
