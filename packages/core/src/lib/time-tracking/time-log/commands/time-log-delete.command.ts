import { ICommand } from '@nestjs/cqrs';
import { ID, IDeleteTimeLogData } from '@gauzy/contracts';
import { TimeLog } from './../time-log.entity';

export class TimeLogDeleteCommand implements ICommand {
	static readonly type = '[TimeLog] delete';

	constructor(
		public readonly ids: ID | ID[] | TimeLog | TimeLog[],
		public readonly timeLogMap: Record<ID, IDeleteTimeLogData>,
		public readonly forceDelete = false
	) { }
}
