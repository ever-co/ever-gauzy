import { ICommand } from '@nestjs/cqrs';
import { ITask, ITaskUpdateInput } from '@gauzy/contracts';

export class TaskUpdateCommand implements ICommand {
	static readonly type = '[Tasks] Update Task';

	constructor(
		public readonly id: ITask['id'],
		public readonly input: ITaskUpdateInput
	) {}
}
