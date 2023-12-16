import { ICommand } from '@nestjs/cqrs';
import { IGetTimeLogInput, ITimeLog } from '@gauzy/contracts';

export class GetTimeLogGroupByClientCommand implements ICommand {
	static readonly type = '[TimeLog] group by client';

	constructor(
		public readonly timeLogs: ITimeLog[],
		public readonly timezone: IGetTimeLogInput['timezone']
	) { }
}
