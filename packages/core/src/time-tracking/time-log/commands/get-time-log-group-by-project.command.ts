import { ICommand } from '@nestjs/cqrs';
import { IGetTimeLogInput, ITimeLog } from '@gauzy/contracts';

export class GetTimeLogGroupByProjectCommand implements ICommand {
	static readonly type = '[TimeLog] group by project';

	constructor(
		public readonly timeLogs: ITimeLog[],
		public readonly timezone: IGetTimeLogInput['timezone']
	) { }
}
