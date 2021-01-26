import { ICommand } from '@nestjs/cqrs';
import { ITaskUpdateInput } from '@gauzy/contracts';

export class TaskUpdateCommand implements ICommand {
	static readonly type = '[Tasks] Update Task';

	constructor(public readonly input: ITaskUpdateInput) {}
}
