import { ICommand } from '@nestjs/cqrs';
import { ITask, ITaskUpdateInput } from '@gauzy/contracts';

export class TaskUpdateCommand implements ICommand {
	static readonly type = '[Tasks] Update Task';

	constructor(
		public readonly id: ITask['id'],
		public readonly input: ITaskUpdateInput,
		public readonly triggeredEvent: boolean = true // Enabled the "2 Way Sync Triggered Event" Synchronization
	) { }
}
