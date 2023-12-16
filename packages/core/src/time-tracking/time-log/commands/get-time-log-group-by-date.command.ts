import { ICommand } from '@nestjs/cqrs';
import { IGetTimeLogInput, ITimeLog } from '@gauzy/contracts';

export class GetTimeLogGroupByDateCommand implements ICommand {
	static readonly type = '[TimeLog] group by date';

	constructor(
		public readonly timeLogs: ITimeLog[],
		public readonly timezone: IGetTimeLogInput['timezone']
	) { }
}
