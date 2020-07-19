import { ICommand } from '@nestjs/cqrs';
import { ITaskCreateInput } from '@gauzy/models';

export class TaskCreateCommand implements ICommand {
	static readonly type = '[Tasks] Create Task';

	constructor(public readonly input: ITaskCreateInput) {}
}
