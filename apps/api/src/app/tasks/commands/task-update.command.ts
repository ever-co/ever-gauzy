import { ICommand } from '@nestjs/cqrs';
import { ITaskUpdateInput } from '@gauzy/models';

export class TaskUpdateCommand implements ICommand {
	static readonly type = '[Tasks] Update Task';

	constructor(public readonly input: ITaskUpdateInput) {}
}
