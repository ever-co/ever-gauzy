import { ICommand } from '@nestjs/cqrs';
import { ITimeLogCreateInput } from '@gauzy/models';

export class TimeLogCreateCommand implements ICommand {
	static readonly type = '[TimeLog] Create TimeLog';

	constructor(public readonly input: ITimeLogCreateInput) {}
}
