import { ICommand } from '@nestjs/cqrs';
import { IGetTimeLogInput, ITimeLog } from '@gauzy/contracts';

export class GetTimeLogGroupByEmployeeCommand implements ICommand {
	static readonly type = '[TimeLog] group by employee';

	constructor(
		public readonly timeLogs: ITimeLog[],
		public readonly timezone: IGetTimeLogInput['timezone']
	) { }
}
