import { ICommand } from '@nestjs/cqrs';
import { TimeLog } from '../../time-log.entity';
import { IDateRange } from '@gauzy/contracts';

export class DeleteTimeSpanCommand implements ICommand {
	static readonly type = '[TimeLog] delete time span';

	constructor(
		public readonly newTime: IDateRange,
		public readonly timeLog: TimeLog
	) {}
}
