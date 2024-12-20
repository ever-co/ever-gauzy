import { ICommand } from '@nestjs/cqrs';
import { ID } from '@gauzy/contracts';
import { TimeLog } from './../time-log.entity';

export class TimeLogDeleteCommand implements ICommand {
	static readonly type = '[TimeLog] delete';

	constructor(public readonly ids: ID | ID[] | TimeLog | TimeLog[], public readonly forceDelete = false) {}
}
