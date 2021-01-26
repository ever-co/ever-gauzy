import { ICommand } from '@nestjs/cqrs';
import { TimeLog } from '../../time-log.entity';

export class TimeLogDeleteCommand implements ICommand {
	static readonly type = '[TimeLog] delete';

	constructor(
		public readonly ids: string | string[] | TimeLog | TimeLog[],
		public readonly forceDelete = false
	) {}
}
